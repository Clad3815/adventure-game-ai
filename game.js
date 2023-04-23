const readline = require('readline');
const aiFunction = require('../ai-function-helper/src/aiFunction');
const chalk = require('chalk'); // Import chalk
const fs = require('fs');
// const ora = require('ora'); // Import ora for the spinner

let ora;

const loadingMessage = 'Thinking...';

async function loadOra() {
    ora = (await
        import ('ora')).default;
}

let spinner;

const enableDebug = false; // Set to true to enable debug mode
const enableAIDebug = true; // Set to true to enable debug mode for AI request/answer
let translateMenu = false; // Set to true to translate the menu

let choosenLanguage = '';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

async function getUserInput(prompt, translate = false, defaultInput = '') {
    prompt = prompt.trim();
    if (translate) prompt = await TranslateText(prompt);
    if (defaultInput != '') prompt = prompt + ` [${defaultInput}] : `;
    else prompt = prompt + ' : ';
    return new Promise((resolve) => {
        rl.question(chalk.yellow(prompt), (input) => {
            // Check if default input is set and if so, return it if the user input is empty
            if (defaultInput != '' && input == '') {
                input = defaultInput;
            }
            resolve(input);
        });
    });
}

let possible_classes = [];

async function TranslateText(text) {
    if (choosenLanguage == '' || choosenLanguage == 'en' || !translateMenu) {
        return text;
    }
    spinner = await ora("Translating...").start(); // Create a spinner with "Loading..." text
    spinner.start(); // Start the spinner before each API call
    let aiData = await aiFunction({
        args: {
            text: text,
            to: choosenLanguage,
        },
        functionName: "translate_text",
        description: "Translate text from one language to another. Use the to arguments to specify destination language. The text is from a game user interface. Return a string with the translated text.",
        funcReturn: "str",
        showDebug: false,
        autoConvertReturn: true,
        temperature: 0.7,
    });
    spinner.stop(); // Stop the spinner after each API call
    return aiData;
}

async function shortenSentence(sentence) {
    if (enableAIDebug) console.log(chalk.blue('[DEBUG] Shortening sentence: "') + chalk.red(sentence) + chalk.blue('" ...'));
    spinner = await ora("Shortening sentence ...").start(); // Create a spinner with "Loading..." text
    spinner.start(); // Start the spinner before each API call
    let aiData = await aiFunction({
        args: {
            sentence: sentence,
        },
        functionName: "shorten_sentence",
        description: "Rewrite the sentence to a minimum of words without breaking the context or important data. If the sentence can't be shorten, it will return the same sentence.",
        funcReturn: "str",
        temperature: 1,
    });
    if (enableAIDebug) console.log(chalk.blue('[DEBUG] Shortened sentence: "') + chalk.red(aiData) + chalk.blue('"'));
    spinner.stop(); // Stop the spinner after each API call
    return aiData;
}

async function initializePlayerAttributes(gameState, playerClass) {
    let prompt = fs.readFileSync('./prompt/generate_player_attributes.txt', 'utf8');
    spinner = await ora(`Generating player attributes...`).start(); // Create a spinner with "Loading..." text
    spinner.start(); // Start the spinner before each API call
    aiData = await aiFunction({
        args: {
            gameSettings: gameState.gameSettings,
            playerClass: playerClass,
        },
        functionName: "generate_player_attribut",
        description: prompt,
        funcReturn: "dict[hp, max_hp, mana, max_mana, money, attributes_list]",
        showDebug: enableDebug,
        autoConvertReturn: true,
        temperature: 0.7,
    });
    spinner.stop(); // Stop the spinner after each API call
    if (aiData == null) {
        console.log(chalk.red(`####################`));
        console.log(chalk.red(`Error: ${aiData}`));
        console.log(chalk.red(`####################`));
        return [];
    }

    return aiData;
}

async function generateValidClass(gameState, playerDescription, playerSex) {
    let prompt = fs.readFileSync('./prompt/generate_random_classes.txt', 'utf8');
    spinner = await ora(`Generating player classes...`).start(); // Create a spinner with "Loading..." text
    spinner.start(); // Start the spinner before each API call
    aiData = await aiFunction({
        args: {
            gameSettings: gameState.gameSettings,
            playerDescription: playerDescription,
            playerSex: playerSex,
        },
        functionName: "generate_player_class",
        description: prompt,
        funcReturn: "list[str]",
        showDebug: enableDebug,
        autoConvertReturn: true,
        temperature: 0.7,
    });
    spinner.stop(); // Stop the spinner after each API call
    if (aiData == null) {
        console.log(chalk.red(`####################`));
        console.log(chalk.red(`Error: ${aiData}`));
        console.log(chalk.red(`####################`));
        return [];
    }
    return aiData;
}

async function getValidClass(validClasses) {
    let playerClass;
    do {
        playerClass = await getUserInput('Choose a class (' + validClasses.join(', ') + ')', true, validClasses[0]);
    } while (!validClasses.includes(playerClass));

    return playerClass;
}
async function main() {
    await loadOra();
    spinner = await ora(loadingMessage).start(); // Create a spinner with "Loading..." text
    spinner.stop(); // Stop the spinner after each API call
    console.log(chalk.red(`############################`));
    console.log(chalk.red(`## Generate Your Own Game ##`));
    console.log(chalk.red(`############################`));
    let prompt = fs.readFileSync('./prompt/game_prompt.txt', 'utf8');
    const gameLanguage = await getUserInput('Choose the language of the game (en, fr, etc.)', false, 'en');
    const translateMenuAsk = await getUserInput('Do you want to translate the menu of the game?', false, 'yes');
    translateMenu = translateMenuAsk == 'yes' ? true : false;
    choosenLanguage = gameLanguage;
    const username = await getUserInput('Choose your player username', true, 'Jack');
    const gameEnvironment = await getUserInput('Choose the environment of the game (cyberpunk, medieval, Star Wars, ...)', true, 'cyberpunk');
    const playerScenario = await getUserInput('Write a short scenario for the start of the game (Optional)', true, '');
    const gameDifficulty = await getUserInput('Choose the difficulty of the game (easy, medium, hard, etc.)', true, 'easy');
    const playerSex = await getUserInput('Choose the sex of your character', true, 'male');
    const description = await getUserInput('Choose the description of your character and all his traits', true, 'Nothing special');

    let player;
    let Welcome = await TranslateText(`\nWelcome, ${username} ! The game is about to start. Have fun! `);
    console.log(chalk.green(Welcome));

    let gameState = {
        gameSettings: {
            gameEnvironment: gameEnvironment,
            gameDifficulty: gameDifficulty,
            gameLanguage: gameLanguage
        },
    };

    possible_classes = await generateValidClass(gameState, description, playerSex);
    const playerClass = await getValidClass(possible_classes);
    player = {
        username,
        class: playerClass,
        sex: playerSex,
        playerDescription: description,
        ...await initializePlayerAttributes(gameState, playerClass),
    };
    let baseScenario;
    if (playerScenario != '') {
        if (enableAIDebug) console.log(chalk.red(`[DEBUG] Generating base scenario for ${player.username} with user scenario:`) + chalk.green(`${playerScenario}`));
        spinner = await ora(`Generating player scenario based on user input...`).start(); // Create a spinner with "Loading..." text
        spinner.start(); // Start the spinner before each API call
        baseScenario = await aiFunction({
            args: {
                gameSettings: gameState.gameSettings,
                player: player,
                main_idea: playerScenario,
            },
            functionName: "generate_player_scenario",
            description: `Generate a scenario for the player using all player informations and the main idea. Use the gameSettings to modify game aspects like language (The output text must match the language selected but variable name must always be in english), difficulty, game environment (cyberpunk, medieval, fantasy, etc.), and other settings.`,
            funcReturn: "str",
            showDebug: enableDebug,
            temperature: 0.7,
        });
        spinner.stop(); // Stop the spinner after each API call
        if (enableAIDebug) console.log(chalk.red(`[DEBUG] Generated scenario: `) + chalk.green(`${baseScenario}`));
    } else {
        spinner = await ora(`Generating random player scenario...`).start(); // Create a spinner with "Loading..." text
        if (enableAIDebug) console.log(chalk.red(`[DEBUG] Generating base scenario for ${player.username}`));
        spinner.start(); // Start the spinner before each API call
        baseScenario = await aiFunction({
            args: {
                gameSettings: gameState.gameSettings,
                player: player,
            },
            functionName: "generate_player_scenario",
            description: "Generate a scenario for the player using all player informations. Use the gameSettings to modify game aspects like language (The output text must match the language selected but variable name must always be in english), difficulty, game environment (cyberpunk, medieval, fantasy, etc.), and other settings.",
            funcReturn: "str",
            showDebug: enableDebug,
            temperature: 0.7,
        });
        spinner.stop(); // Stop the spinner after each API call
        if (enableAIDebug) console.log(chalk.red(`[DEBUG] Generated scenario: `) + chalk.green(`${baseScenario}`));
    }
    console.log(chalk.green(`\nScenario: `) + chalk.yellow(`${baseScenario}`) + `\n`);
    gameState = {
        text_history: [],
        current_choice: {
            "narrative_text": baseScenario,
            "user_choice": "Start the Game"
        },
        playerData: {
            hp: player.hp,
            max_hp: player.max_hp,
            money: player.money,
            mana: player.mana,
            max_mana: player.max_mana,
            exp: 0,
            level: 1,
            class: player.class,
            sex: player.sex,
            username: player.username,
            description: player.playerDescription,
            attributes: player.attributes_list,
            inventory: [],
            location: {
                "location_name": "",
                "location_reason": "",
                "location_type": "",
                "location_sub": "",
            },
            quest: {
                "quest_name": "No Quest",
                "quest_description": "Find a quest to start your adventure !",
                "quest_type": "",
                "quest_reward": ""
            }
        },
        gameSettings: {
            gameEnvironment: gameEnvironment,
            gameDifficulty: gameDifficulty,
            gameLanguage: gameLanguage
        },
    };


    while (true) {
        let aiData;
        let currentChoice;
        try {
            let description = prompt;
            currentChoice = gameState.current_choice;
            if (gameState.playerData.inventory == null || gameState.playerData.inventory.length == 0) {
                description += `\nVERY IMPORTANT: If the player has no inventory, generate an inventory for the start of the game (up to 10 items), the items must match the game environement and other data (difficulty, player class, etc ...). Example of item: 
				[{
				"name": "Knife",
				"count": 1,
				"type": "weapon",
				"value": 1,
				"equipped": true,
				}, ...]
				And generate a player "location" based on the scenario (home, forest, etc ...). Example of location:
				{
					"location_name": "Home of the lawyer",
					"location_reason": "You are there for the quest given by your employer.",
					"location_type": "home",
					"location_sub": "Living Room",
				}
				`;
            }
            if (enableAIDebug) console.log(chalk.red('[DEBUG] Sending request to AI: ') + chalk.yellow(JSON.stringify(gameState)));
            spinner = await ora(loadingMessage).start(); // Create a spinner with "Loading..." text
            spinner.start(); // Start the spinner before each API call
            aiData = await aiFunction({
                args: gameState,
                functionName: "text_based_adventure_game",
                description: description.split('\n').map(line => line.trim()).join('\n'),
                funcReturn: "dict",
                showDebug: enableDebug,
                temperature: 0.8,
                frequency_penalty: 0.6,
                presence_penalty: 0.6,
                // model: "gpt4",
            });
            spinner.stop(); // Stop the spinner after each API call
            if (enableDebug) console.log(aiData);
            if (enableAIDebug) console.log(chalk.red('[DEBUG] Data got from AI: ') + chalk.yellow(JSON.stringify(aiData)) + '\n');
        } catch (error) {
            spinner.stop(); // Stop the spinner after each API call
            console.log(error);
            continue;
        }

        if (!aiData.possible_choices) {
            console.log(chalk.red(`No possible choices, regenerating...`));
            continue;
        }

        // Show new items and the count from inventory if the player has new items and show removed items if the player has lost items
        if (aiData.player.inventory) {
            let newItems = [];
            let removedItems = [];
            let inventory = aiData.player.inventory;
            let oldInventory = gameState.playerData.inventory;
            for (let i = 0; i < inventory.length; i++) {
                let found = false;
                for (let j = 0; j < oldInventory.length; j++) {
                    if (inventory[i].name == oldInventory[j].name) {
                        found = true;
                        if (inventory[i].count != oldInventory[j].count) {
                            if (inventory[i].count > oldInventory[j].count) {
                                newItems.push({
                                    name: inventory[i].name,
                                    count: inventory[i].count - oldInventory[j].count,
                                });
                            } else {
                                removedItems.push({
                                    name: inventory[i].name,
                                    count: oldInventory[j].count - inventory[i].count,
                                });
                            }
                        }
                    }
                }
                if (!found) {
                    newItems.push({
                        name: inventory[i].name,
                        count: inventory[i].count,
                    });
                }
            }
            for (let i = 0; i < oldInventory.length; i++) {
                let found = false;
                for (let j = 0; j < inventory.length; j++) {
                    if (oldInventory[i].name == inventory[j].name) {
                        found = true;
                    }
                }
                if (!found) {
                    removedItems.push({
                        name: oldInventory[i].name,
                        count: oldInventory[i].count,
                    });
                }
            }
            if (newItems.length > 0) {
                console.log(chalk.green(`> You got new items: ${newItems.map(item => `${item.count} ${item.name}`).join(', ')}`));
			}
			if (removedItems.length > 0) {
				console.log(chalk.red(`> You lost items: ${removedItems.map(item => `${item.count} ${item.name}`).join(', ')}`));
			}
        }

        // Show new players attributes (hp, mana, exp, level, etc ...) if the player has new attributes
        if (aiData.player.hp && aiData.player.hp != gameState.playerData.hp) {
            console.log(chalk.green(`> Your HP is now ${aiData.player.hp}/${gameState.playerData.max_hp}`));
        }
        if (aiData.player.mana && aiData.player.mana != gameState.playerData.mana) {
            console.log(chalk.green(`> Your mana is now ${aiData.player.mana}/${gameState.playerData.max_mana}`));
        }
        if (aiData.player.exp && aiData.player.exp != gameState.playerData.exp) {
            console.log(chalk.green(`> Your exp is now ${aiData.player.exp}`));
        }
        if (aiData.player.level && aiData.player.level != gameState.playerData.level) {
            console.log(chalk.green(`> Your level is now ${aiData.player.level}`));
        }
        if (aiData.player.money && aiData.player.money != gameState.playerData.money) {
            console.log(chalk.green(`> Your money is now ${aiData.player.money}`));
        }




        if (aiData.narrative_text) {
            aiData.text = aiData.narrative_text;
        }
		console.log(chalk.cyan(aiData.text));
		if (aiData.possible_choices.length === 0) {
			aiData.possible_choices.push("Continue");
		}

		aiData.possible_choices.forEach((choice, index) => {
			console.log(chalk.yellow(`${index + 1}: ${choice}`));
		});

		const acceptIAAnswer = await getUserInput(chalk.magenta('Accept AI answer? (y/n) '));
		if (acceptIAAnswer.toLowerCase() != 'y') {
			continue;
		}
        if (aiData.player.inventory) {
            gameState.playerData.inventory = aiData.player.inventory;
        }
        if (aiData.player.hp) {
            gameState.playerData.hp = aiData.player.hp;
        }
        if (aiData.player.max_hp) {
            gameState.playerData.max_hp = aiData.player.max_hp;
        }
        if (aiData.player.money) {
            gameState.playerData.money = aiData.player.money;
        }
        if (aiData.player.mana) {
            gameState.playerData.mana = aiData.player.mana;
        }
        if (aiData.player.max_mana) {
            gameState.playerData.max_mana = aiData.player.max_mana;
        }
        if (aiData.player.exp) {
            gameState.playerData.exp = aiData.player.exp;
        }
        if (aiData.player.level) {
            gameState.playerData.level = aiData.player.level;
        }

		if (aiData.player.location) {
			gameState.playerData.location = aiData.player.location;
		}


        const userInput = await getUserInput(chalk.magenta('Choose an option (1, 2, ... or custom): '));
        if (isNaN(userInput)) {
            aiData.possible_choices.push(userInput);
            userChoice = aiData.possible_choices.length;
        } else {
            userChoice = userInput;
        }
        const current_choice = aiData.possible_choices[userChoice - 1];

		gameState.text_history.push({
			narrative_text: await shortenSentence(currentChoice.narrative_text),
			user_choice: currentChoice.user_choice,
		});
		

		gameState.current_choice = {
			narrative_text: aiData.text,
			user_choice: current_choice,
		};

        if (gameState.text_history.length > 7) {
            gameState.text_history.shift();
        }

        console.log(' ');

        if (aiData.game_over) {
            break;
        }
    }

    rl.close();


}
main();