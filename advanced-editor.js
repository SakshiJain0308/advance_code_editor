// Monaco Editor Setup
require.config({ 
    paths: { 
        vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' 
    },
    'vs/nls': {
        availableLanguages: {
            '*': 'en'
        }
    }
});

let editor; // Monaco editor instance
let recognition; // Speech recognition instance
let currentFile = 'untitled.js';
let files = new Map();
let snippets = new Map();
let terminalHistory = [];
let terminalHistoryIndex = -1;
let pyodide; // Pyodide instance
let isPythonReady = false;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

// Show loading overlay
function showLoading(message) {
    const loading = document.getElementById('loading');
    const messageElement = loading.querySelector('p');
    messageElement.textContent = message;
    loading.style.display = 'flex';
}

// Hide loading overlay
function hideLoading() {
    const loading = document.getElementById('loading');
    loading.style.display = 'none';
}

// Initialize Pyodide
async function initializePyodide() {
    try {
        showLoading('Loading Python environment...');
        
        // Load Pyodide with specific version and configuration
        pyodide = await loadPyodide({
            indexURL: "https://pyodide-cdn2.iodide.io/v0.24.1/full/",
            stdout: (text) => {
                console.innerHTML += `<div class="console-message">${text}</div>`;
            },
            stderr: (text) => {
                console.innerHTML += `<div class="error-message">${text}</div>`;
            }
        });

        // Load required Python packages
        showLoading('Loading Python packages...');
        await pyodide.loadPackage(['numpy', 'matplotlib']);
        
        // Test Python environment
        await pyodide.runPythonAsync(`
            import sys
            print(f"Python {sys.version} loaded successfully")
        `);

        isPythonReady = true;
        hideLoading();
        showStatus('Python environment ready');
        setTimeout(hideStatus, 2000);
    } catch (error) {
        console.error('Pyodide initialization error:', error);
        initializationAttempts++;
        
        if (initializationAttempts < MAX_INIT_ATTEMPTS) {
            showLoading(`Retrying initialization (${initializationAttempts}/${MAX_INIT_ATTEMPTS})...`);
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
            return initializePyodide();
        } else {
            hideLoading();
            showStatus('Failed to initialize Python environment after multiple attempts. Please check your internet connection and refresh the page.');
            setTimeout(hideStatus, 5000);
            isPythonReady = false;
        }
    }
}

// Initialize everything
require(['vs/editor/editor.main'], async function() {
    try {
        // Initialize Monaco Editor
        editor = monaco.editor.create(document.getElementById('monaco-editor'), {
            value: '// Start coding here...\nconsole.log("Hello, World!")',
            language: 'javascript',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            cursorStyle: 'line',
            quickSuggestions: true,
            rulers: [80],
            wordWrap: 'on',
            tabSize: 4,
            insertSpaces: true,
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            formatOnPaste: true,
            formatOnType: true
        });

        // Initialize Pyodide
        await initializePyodide();

        // Set up language services
        setupLanguageServices();
        
        // Set up event listeners
        setupEventListeners();
        
        // Initialize speech recognition
        setupSpeechRecognition();

        // Set up file system
        setupFileSystem();
        
        // Set up snippets
        setupSnippets();
        
        // Set up terminal
        setupTerminal();

        // Update cursor position
        editor.onDidChangeCursorPosition(e => {
            const position = editor.getPosition();
            document.getElementById('cursorPosition').textContent = 
                `Ln ${position.lineNumber}, Col ${position.column}`;
        });

        // Handle editor errors
        editor.onDidChangeModelContent(() => {
            const model = editor.getModel();
            const markers = monaco.editor.getModelMarkers({ resource: model.uri });
            updateProblemsPanel(markers);
            updateFileSize();
        });

    } catch (error) {
        console.error('Initialization error:', error);
        hideLoading();
        showStatus('Failed to initialize editor. Please refresh the page.');
    }
});

// Setup Language Services
function setupLanguageServices() {
    const languageSelect = document.getElementById('languageSelect');
    const themeSelect = document.getElementById('themeSelect');

    languageSelect.addEventListener('change', () => {
        const language = languageSelect.value;
        monaco.editor.setModelLanguage(editor.getModel(), language);
        currentFile = `untitled.${getFileExtension(language)}`;
        updateFileList();
    });

    themeSelect.addEventListener('change', () => {
        const theme = themeSelect.value;
        monaco.editor.setTheme(theme);
    });

    // Add language-specific features
    monaco.languages.registerCompletionItemProvider('javascript', {
        provideCompletionItems: function(model, position) {
            const suggestions = [
                {
                    label: 'console.log',
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'console.log()',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                },
                {
                    label: 'function',
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: 'function $1($2) {\n\t$3\n}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                },
                {
                    label: 'for',
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: 'for (let i = 0; i < $1; i++) {\n\t$2\n}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                }
            ];
            return { suggestions: suggestions };
        }
    });
    
    // Add Java completions
    monaco.languages.registerCompletionItemProvider('java', {
        provideCompletionItems: function(model, position) {
            const suggestions = [
                {
                    label: 'main',
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'public static void main(String[] args) {\n\t$0\n}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                },
                {
                    label: 'sout',
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'System.out.println($0);',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                },
                {
                    label: 'class',
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: 'public class $1 {\n\t$0\n}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                },
                {
                    label: 'for',
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: 'for (int i = 0; i < $1; i++) {\n\t$0\n}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                }
            ];
            return { suggestions: suggestions };
        }
    });
    
    // Add C++ completions
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function(model, position) {
            const suggestions = [
                {
                    label: 'main',
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'int main() {\n\t$0\n\treturn 0;\n}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                },
                {
                    label: 'cout',
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'std::cout << $0 << std::endl;',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                },
                {
                    label: 'cin',
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'std::cin >> $0;',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                },
                {
                    label: 'include',
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: '#include <$0>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                },
                {
                    label: 'for',
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: 'for (int i = 0; i < $1; i++) {\n\t$0\n}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                }
            ];
            return { suggestions: suggestions };
        }
    });
}

// Setup Event Listeners
function setupEventListeners() {
    // Run button
    document.getElementById('runButton').addEventListener('click', runCode);
    
    // Format button
    document.getElementById('formatButton').addEventListener('click', () => {
        editor.getAction('editor.action.formatDocument').run();
    });
    
    // Clear button
    document.getElementById('clearButton').addEventListener('click', () => {
        document.getElementById('output').innerHTML = '';
        document.getElementById('console').innerHTML = '';
    });

    // Save button
    document.getElementById('saveButton').addEventListener('click', saveCurrentFile);
    
    // Load button
    document.getElementById('loadButton').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.dataset.tab;
            
            // Update active tab button
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
            
            // Update active tab content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tab).classList.add('active');
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to run code
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            runCode();
        }
        // Ctrl/Cmd + S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveCurrentFile();
        }
    });
}

// Setup File System
function setupFileSystem() {
    const fileList = document.getElementById('fileList');
    const newFileButton = document.getElementById('newFileButton');
    const fileInput = document.getElementById('fileInput');
    
    newFileButton.addEventListener('click', createNewFile);
    fileInput.addEventListener('change', handleFileUpload);
    
    // Add initial file
    files.set(currentFile, editor.getValue());
    updateFileList();
}

// Setup Snippets
function setupSnippets() {
    const snippetList = document.getElementById('snippetList');
    
    // Add default snippets
    addSnippet('Console Log', 'console.log()');
    addSnippet('Function', 'function $1($2) {\n\t$3\n}');
    addSnippet('Arrow Function', 'const $1 = ($2) => {\n\t$3\n}');
    addSnippet('For Loop', 'for (let i = 0; i < $1; i++) {\n\t$2\n}');
    addSnippet('If Statement', 'if ($1) {\n\t$2\n}');
    addSnippet('Try Catch', 'try {\n\t$1\n} catch (error) {\n\t$2\n}');
}

// Setup Terminal
function setupTerminal() {
    const terminalInput = document.querySelector('.command-input');
    const terminalOutput = document.querySelector('.terminal-output');
    
    terminalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const command = terminalInput.value;
            terminalInput.value = '';
            
            // Add command to history
            terminalHistory.push(command);
            terminalHistoryIndex = terminalHistory.length;
            
            // Execute command
            executeTerminalCommand(command);
        } else if (e.key === 'ArrowUp') {
            if (terminalHistoryIndex > 0) {
                terminalHistoryIndex--;
                terminalInput.value = terminalHistory[terminalHistoryIndex];
            }
        } else if (e.key === 'ArrowDown') {
            if (terminalHistoryIndex < terminalHistory.length - 1) {
                terminalHistoryIndex++;
                terminalInput.value = terminalHistory[terminalHistoryIndex];
            } else {
                terminalHistoryIndex = terminalHistory.length;
                terminalInput.value = '';
            }
        }
    });
}

// Execute Terminal Command
function executeTerminalCommand(command) {
    const terminalOutput = document.querySelector('.terminal-output');
    const prompt = document.querySelector('.prompt');
    
    // Add command to output
    terminalOutput.innerHTML += `<div class="command">${prompt.textContent} ${command}</div>`;
    
    try {
        // Execute command
        const result = eval(command);
        
        // Add result to output
        if (result !== undefined) {
            terminalOutput.innerHTML += `<div class="result">${result}</div>`;
        }
    } catch (error) {
        terminalOutput.innerHTML += `<div class="error">Error: ${error.message}</div>`;
    }
    
    // Scroll to bottom
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// File Operations
function createNewFile() {
    const fileName = prompt('Enter file name:', currentFile);
    if (fileName) {
        currentFile = fileName;
        files.set(fileName, '');
        editor.setValue('');
        updateFileList();
    }
}

function saveCurrentFile() {
    const content = editor.getValue();
    files.set(currentFile, content);
    showStatus('File saved successfully');
    setTimeout(hideStatus, 2000);
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentFile = file.name;
            files.set(currentFile, e.target.result);
            editor.setValue(e.target.result);
            updateFileList();
        };
        reader.readAsText(file);
    }
}

function updateFileList() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    
    files.forEach((content, name) => {
        const div = document.createElement('div');
        div.className = 'file-list-item' + (name === currentFile ? ' active' : '');
        div.textContent = name;
        div.onclick = () => openFile(name);
        fileList.appendChild(div);
    });
}

function openFile(name) {
    currentFile = name;
    editor.setValue(files.get(name));
    updateFileList();
}

// Snippet Operations
function addSnippet(name, content) {
    snippets.set(name, content);
    updateSnippetList();
}

function updateSnippetList() {
    const snippetList = document.getElementById('snippetList');
    snippetList.innerHTML = '';
    
    snippets.forEach((content, name) => {
        const div = document.createElement('div');
        div.className = 'snippet-item';
        div.textContent = name;
        div.onclick = () => insertSnippet(content);
        snippetList.appendChild(div);
    });
}

function insertSnippet(content) {
    const position = editor.getPosition();
    editor.executeEdits('snippet', [{
        range: new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
        ),
        text: content
    }]);
}

// Run Code
async function runCode() {
    const outputDiv = document.getElementById('output');
    const consoleDiv = document.getElementById('console');
    const language = document.getElementById('languageSelect').value;
    const code = editor.getValue();
    
    // Clear output and console
    outputDiv.innerHTML = '';
    consoleDiv.innerHTML = '';
    
    // Show loading
    showStatus('Running code...');
    
    try {
        if (language === 'javascript') {
            // Run JavaScript code directly in the browser
            const originalConsole = { log: console.log, error: console.error, warn: console.warn };
            
            // Override console methods to capture output
            console.log = function() {
                const args = Array.from(arguments);
                const message = args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ');
                
                consoleDiv.innerHTML += `<div class="console-message">${message}</div>`;
                originalConsole.log(...arguments);
            };
            
            console.error = function() {
                const args = Array.from(arguments);
                const message = args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ');
                
                consoleDiv.innerHTML += `<div class="error-message">${message}</div>`;
                originalConsole.error(...arguments);
            };
            
            console.warn = function() {
                const args = Array.from(arguments);
                const message = args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ');
                
                consoleDiv.innerHTML += `<div class="warning-message">${message}</div>`;
                originalConsole.warn(...arguments);
            };
            
            try {
                // Execute the code
                const result = eval(`
                    (function() {
                        try {
                            ${code}
                        } catch(e) {
                            console.error('Runtime Error:', e.message);
                            throw e;
                        }
                    })();
                `);
                
                // Display result if needed
                if (result !== undefined) {
                    outputDiv.innerHTML = `<div class="result">Result: ${
                        typeof result === 'object' ? JSON.stringify(result, null, 2) : result
                    }</div>`;
                }
                
                // Restore original console
                console.log = originalConsole.log;
                console.error = originalConsole.error;
                console.warn = originalConsole.warn;
                
                showStatus('Code executed successfully');
                setTimeout(hideStatus, 2000);
            } catch (error) {
                outputDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
                console.error = originalConsole.error;
                console.log = originalConsole.log;
                console.warn = originalConsole.warn;
                
                showStatus('Execution failed');
                setTimeout(hideStatus, 2000);
            }
        } else if (language === 'java' || language === 'cpp') {
            // Use Judge0 API for Java and C++ compilation
            const languageId = language === 'java' ? 62 : 54; // 62 for Java, 54 for C++
            
            // Judge0 API endpoint (using the public instance, consider getting your own API key for production)
            const response = await fetch('https://judge0-ce.p.rapidapi.com/submissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
                    'X-RapidAPI-Key': '270f85eb9fmsh4afa9cec573274dp10b5eajsn26c34ef0ffa8'
                },
                body: JSON.stringify({
                    language_id: languageId,
                    source_code: code,
                    stdin: ''
                })
            });
            
            const submissionData = await response.json();
            const token = submissionData.token;
            
            // Poll for results
            let result;
            let attempts = 0;
            const maxAttempts = 10;
            
            const checkStatus = async () => {
                if (attempts >= maxAttempts) {
                    throw new Error('Compilation timeout. Please try again.');
                }
                
                attempts++;
                const statusResponse = await fetch(`https://judge0-ce.p.rapidapi.com/submissions/${token}?base64_encoded=false`, {
                    method: 'GET',
                    headers: {
                        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
                        'X-RapidAPI-Key': '270f85eb9fmsh4afa9cec573274dp10b5eajsn26c34ef0ffa8' 
                    }
                });
                
                const statusData = await statusResponse.json();
                
                if (statusData.status && statusData.status.id <= 2) {
                    // Status 1-2: In Queue / Processing, wait and check again
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return checkStatus();
                }
                
                return statusData;
            };
            
            result = await checkStatus();
            
            // Display results
            if (result.compile_output) {
                consoleDiv.innerHTML += `<div class="error-message">Compilation Error: ${result.compile_output}</div>`;
                outputDiv.innerHTML = `<div class="error">Compilation failed</div>`;
            } else if (result.stderr) {
                consoleDiv.innerHTML += `<div class="error-message">Runtime Error: ${result.stderr}</div>`;
                outputDiv.innerHTML = `<div class="error">Execution failed</div>`;
            } else {
                if (result.stdout) {
                    outputDiv.innerHTML = `<div class="result">${result.stdout}</div>`;
                }
                showStatus('Code executed successfully');
            }
        } else {
            outputDiv.innerHTML = `<div class="error">Unsupported language: ${language}</div>`;
        }
    } catch (error) {
        outputDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
        showStatus('Execution failed');
    } finally {
        setTimeout(hideStatus, 2000);
    }
}

// Update Problems Panel
function updateProblemsPanel(markers) {
    const problemsPanel = document.getElementById('problems');
    if (markers.length === 0) {
        problemsPanel.innerHTML = '<div class="no-problems">No problems found</div>';
        return;
    }

    let html = '<div class="problems-list">';
    markers.forEach(marker => {
        html += `
            <div class="problem-item ${marker.severity === 1 ? 'error' : 'warning'}">
                <span class="line-number">Line ${marker.startLineNumber}:</span>
                <span class="message">${marker.message}</span>
            </div>
        `;
    });
    html += '</div>';
    problemsPanel.innerHTML = html;
}

// Update File Size
function updateFileSize() {
    const content = editor.getValue();
    const size = new Blob([content]).size;
    document.getElementById('fileSize').textContent = `${size} bytes`;
}

// Get File Extension
function getFileExtension(language) {
    switch(language) {
        case 'javascript':
            return 'js';
        case 'java':
            return 'java';
        case 'cpp':
            return 'cpp';
        default:
            return 'txt';
    }
}

// Status Messages
function showStatus(message) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.classList.add('show');
}

function hideStatus() {
    document.getElementById('status').classList.remove('show');
}

// Setup Speech Recognition
function setupSpeechRecognition() {
    const micButton = document.getElementById('micButton');
    
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        micButton.addEventListener('click', () => {
            if (micButton.classList.contains('recording')) {
                recognition.stop();
                micButton.classList.remove('recording');
            } else {
                recognition.start();
                micButton.classList.add('recording');
            }
        });

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0].transcript)
                .join('');

            if (event.results[0].isFinal) {
                processVoiceCommand(transcript);
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            micButton.classList.remove('recording');
            showStatus('Speech recognition error: ' + event.error);
            setTimeout(hideStatus, 3000);
        };

        recognition.onend = () => {
            micButton.classList.remove('recording');
        };
    } else {
        micButton.disabled = true;
        micButton.title = 'Speech recognition not supported';
        showStatus('Speech recognition is not supported in this browser');
        setTimeout(hideStatus, 3000);
    }
}

// Process Voice Commands
function processVoiceCommand(transcript) {
    const commands = {
        'run': () => runCode(),
        'clear': () => {
            document.getElementById('output').innerHTML = '';
            document.getElementById('console').innerHTML = '';
        },
        'format': () => editor.getAction('editor.action.formatDocument').run(),
        'save': () => saveCurrentFile(),
        'new file': () => createNewFile(),
        'insert': (text) => {
            const position = editor.getPosition();
            editor.executeEdits('voice', [{
                range: new monaco.Range(
                    position.lineNumber,
                    position.column,
                    position.lineNumber,
                    position.column
                ),
                text: text
            }]);
        }
    };

    // Check for special commands
    for (const [command, action] of Object.entries(commands)) {
        if (transcript.toLowerCase().includes(command)) {
            if (command === 'insert') {
                const text = transcript.substring(transcript.indexOf('insert') + 6).trim();
                action(text);
            } else {
                action();
            }
            showStatus(`Executed command: ${command}`);
            setTimeout(hideStatus, 2000);
            return;
        }
    }

    // If no special command, insert the transcript as code
    const position = editor.getPosition();
    editor.executeEdits('voice', [{
        range: new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
        ),
        text: transcript
    }]);
}

