# Adventure Game Generator

Adventure Game Generator is a text-based game creation tool that allows you to generate your own interactive adventure games using the power of OpenAI. This project relies on the [ai-function-helper](https://github.com/Clad3815/ai-function-helper/) library to generate game content and handle player choices.

This project has been tested with `gpt3.5-turbo` and must return better result with `gpt4` model.

## Features

- [x] Customizable game settings, including language, environment, and difficulty
- [x] Auto translate menu language to the game language if wanted
- [x] Dynamic player class generation based on character description and player sex
- [x] Automatic player attribute generation
- [x] Continuous gameplay with generated narrative and choices
- [x] Inventory management
- [x] Automatic location generation
- [x] Automatic quest management
- [x] Automatic player stats management

## Todo

- [x] Make multiple prompt `game-multi-prompt.js` instead of one large one to avoid confusion for `gpt3.5-turbo`
- [x] Manage each data individually to avoid confusion for `gpt3.5-turbo` (ex: `inventory` and `location`)
- [ ] Add `gpt4` support instead of editing `generateNarrativeText` function manually
- [ ] Generate a whole scenario to the game from start to end to follow a story line
- [ ] Generate a main quest to the game
- [ ] Add sub-quest system
- [ ] Add a graphical interface with HTML+CSS+JS to show inventory, stats, map, etc.
- [ ] Rewrite every prompt to reduce token size
- [ ] Add a map system ?
- [ ] Add a battle system ?
- [ ] Add a shop system ?
- [ ] Add a crafting system ?
- [ ] Add a skill system ?
- [ ] More features ?


## GIF Demo

Demonstration:

![Demo](https://github.com/Clad3815/adventure-game-ai/gif/demo.gif?raw=true)

Demonsration with debug mode:

![Demo Debug](https://github.com/Clad3815/adventure-game-ai/gif/demo_debug.gif?raw=true)


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

## Debug
To activate debug mode and AI debug mode within the `game.js` file, you can follow these simple steps:

1. Locate the `game.js` file in your project directory.

2. Open the `game.js` file in your preferred code editor.

3. Find the following lines of code:

```javascript
const enableDebug = false; // Set to true to enable debug mode
const enableAIDebug = false; // Set to true to enable debug mode for AI request/answer

```

4. To enable debug mode, change the value of enableDebug to true, this will show all prompt and answer from AI.

```javascript
const enableDebug = true; // Set to true to enable debug mode
```

5. To enable AI debug mode, change the value of enableAIDebug to true, this will show all data sent and answer from AI (Without the full prompt).

```javascript
const enableAIDebug = true; // Set to true to enable debug mode for AI request/answer
```



## Contributing

Contributions are welcome! If you would like to add more features, improve the existing code, or fix bugs, please feel free to submit a pull request.

## License

This project is licensed under the MIT License.