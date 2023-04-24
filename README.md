# Adventure Game Generator

Adventure Game Generator is a text-based game creation tool that allows you to generate your own interactive adventure games using the power of OpenAI. This project relies on the [ai-function-helper](https://github.com/Clad3815/ai-function-helper/) library to generate game content and handle player choices.

This project has been tested with `gpt3.5-turbo` and must return better result with `gpt4` model.

## Features

- Customizable game settings, including language, environment, and difficulty
- Dynamic player class generation based on character description and player sex
- Automatic player attribute generation
- Continuous gameplay with generated narrative and choices
- Inventory / location and quest management

## Todo

- [ ] Make multiple prompt `game-multi-prompt.js` instead of one large one to avoid confusion for `gpt3.5-turbo`
- [ ] Manage each data individually to avoid confusion for `gpt3.5-turbo` (ex: `inventory` and `location`)
- [ ] Rewrite every prompt to reduce token size

## Requirements

- Node.js (v14.0.0 or higher)
- [ai-function-helper](https://github.com/Clad3815/ai-function-helper/) library


## Installation

1. Clone this repository:

```bash
git clone https://github.com/clad3815/adventure-game-ai.git
```

2. Install dependencies:

```bash
npm install
```

3. Make sure you have [ai-function-helper](https://github.com/Clad3815/ai-function-helper/) installed and configured with your OpenAI API key.

4. Edit the `game.js` file to change the [ai-function-helper](https://github.com/Clad3815/ai-function-helper/) path


## Usage

1. Run the script:

```bash
node game.js
```

2. Follow the prompts to customize your game and create your character. You can also use the default settings by pressing `Enter` when prompted.

3. Play the generated game and enjoy the adventure!


## Contributing

Contributions are welcome! If you would like to add more features, improve the existing code, or fix bugs, please feel free to submit a pull request.

## License

This project is licensed under the MIT License.