<p align="center">
  <h1>A tool to visualize and analyze GitHub repositories using graph theory.</h1>
</p>

[![Build Status](https://img.shields.io/badge/Build-Passing-success)](https://github.com/)
[![License](https://img.shields.io/badge/License-MIT-blue)](https://github.com/)
[![Stars](https://img.shields.io/badge/Stars-0-yellow)](https://github.com/)
[![Language](https://img.shields.io/badge/Language-Multi-colored)](https://github.com/)

## Overview
A tool to provide insights into GitHub repositories by leveraging graph theory and AI-powered file chat. It is designed for developers and repository maintainers who want to better understand their codebase and identify areas for improvement.

## Features
* Analyze repository dependencies and structure using graph theory
* AI-powered file chat for insights into codebase
* Comprehensive analysis of repository dependencies
* Visualization of repository data

## Tech Stack
| Technology | Description |
| --- | --- |
| FastAPI | Backend framework for repository analysis |
| Next.js | Frontend framework for visualization and user interaction |
| Groq API | API for data analysis |
| GitHub Trees API | API for repository data |

## Getting Started
### Prerequisites
* Python 3.8+
* Node.js 14+
* npm 6+

### Installation
```bash
# Install backend dependencies
pip install -r backend/requirements.txt

# Install frontend dependencies
npm install --prefix frontend

# Build frontend
npm run build --prefix frontend
```

### Running
```bash
# Run backend
python backend/main.py

# Run frontend
npm run start --prefix frontend
```

## Architecture
The project utilizes a monorepo architecture with a REST API.

## Project Structure
```markdown
.
├── backend
│   ├── main.py
│   └── requirements.txt
├── frontend
│   ├── app
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── ...
│   ├── eslint.config.mjs
│   ├── next.config.ts
│   ├── postcss.config.mjs
│   ├── package-lock.json
│   ├── package.json
│   └── tsconfig.json
├── .gitignore
├── LICENSE
└── ...
```

## Usage
1. Run the backend using `python backend/main.py`
2. Run the frontend using `npm run start --prefix frontend`
3. Open a web browser and navigate to `http://localhost:3000`

## Contributing
Contributions are welcome! Please submit a pull request with your changes.

## License
[MIT License](https://github.com/)
