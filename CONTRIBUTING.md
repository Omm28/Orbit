# Contributing to Orbit

Thank you for your interest in contributing to Orbit! This project is built with production considerations in mind, and we welcome contributions that improve its robustness, observability, and capability.

## Code of Conduct

Please maintain a respectful, collaborative, and professional environment in all issues, discussions, and pull requests.

## How to Contribute

1. **Fork the Repository:** Create a personal fork of the repository on GitHub.
2. **Clone Locally:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Orbit.git
   cd Orbit
   ```
3. **Install Dependencies:**
   ```bash
   npm install
   npx playwright install chromium
   ```
4. **Create a Branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Implement Changes & Tests:**
   * Write clean, type-safe TypeScript code.
   * Add corresponding unit tests in `tests/unit/` for any utility, schema, or tool changes.
   * Verify the build compiles: `npm run build`
   * Run the unit tests: `npm test`
6. **Submit a Pull Request:** Push your branch to GitHub and open a pull request against the `main` branch.

## Code Style & Standards

* **TypeScript:** Strictly type your inputs, outputs, and classes. Avoid using `any` where possible.
* **ASCII Layout Logs:** Ensure any command-line output matches the clean, emoji-free ASCII console style.
* **Linting & Formatting:** Ensure your code is formatted consistently with the rest of the codebase.
