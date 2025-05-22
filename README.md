# Advanced Code Editor

A web-based code editor with support for JavaScript, Java, and C++ compilation.

## Features

- Edit and run JavaScript directly in the browser
- Compile and run Java and C++ code using the Judge0 API
- Syntax highlighting and code completion
- File management system
- Dark/light theme toggle
- Code formatting
- Voice input support
- Console and output panels

## Setup Instructions

1. Clone this repository
2. Get a RapidAPI key for Judge0:

   - Sign up on [RapidAPI](https://rapidapi.com/)
   - Subscribe to the [Judge0 API](https://rapidapi.com/judge0-official/api/judge0-ce)
   - Copy your API key

3. Open `advanced-editor.js` and replace `YOUR_RAPIDAPI_KEY` with your actual RapidAPI key in both places where it occurs.

4. Serve the files using a local web server:

   ```
   # Using Python's built-in server
   python -m http.server

   # Or using Node.js and http-server
   npx http-server
   ```

5. Open your browser and navigate to `http://localhost:8000` (or the port your server is using)

## Supported Languages

### JavaScript

JavaScript code runs directly in the browser using the built-in JavaScript engine.

Example:

```javascript
console.log("Hello, World!");
```

### Java

Java code is compiled and executed using the Judge0 API.

Example:

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```

### C++

C++ code is compiled and executed using the Judge0 API.

Example:

```cpp
#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}
```

## API Usage Notes

This project uses the Judge0 API for Java and C++ compilation. The free tier has certain limitations:

- Request rate limits
- Execution time limits
- Queue time limits

For production use, consider using a paid plan or setting up your own Judge0 instance.

## License

MIT
