const readline = require('readline');
const aiFunction = require('../ai-function-helper/src/aiFunction');
const chalk = require('chalk'); // Import chalk
const fs = require('fs');
// const ora = require('ora'); // Import ora for the spinner

let ora;

let translateTextTable = {
    error: 'Error',
    generating_class: 'Generating player classes...',
    choose_player_username: 'Choose your player username',
    choose_game_environment: 'Choose the environment of the game (cyberpunk, medieval, Star Wars, ...)',
    choose_game_environment_default: 'cyberpunk',
    choose_game_difficulty: 'Choose the difficulty of the game (easy, medium, hard, etc.)',
    choose_game_difficulty_default: 'easy',
    choose_player_scenario: 'Write a short scenario for the start of the game (Optional)',
    choose_player_sex: 'Choose the sex of your character',
    choose_player_sex_default: 'male',
    choose_player_description: 'Choose the description of your character and all his traits',
    choose_player_description_default: 'Nothing special',
    select_player_action: 'Choose your next action (1, 2, etc ...) or enter custom action',
    select_player_action_custom: 'Your next action',
    player_level_change: 'Your level is now:',
    player_hp_change: 'Your HP is now:',
    player_mana_change: 'Your mana is now:',
    player_exp_change: 'Your experience is now:',
    player_next_level_exp_change: 'Your next level experience is now:',
    player_money_change: 'Your money is now:',
    player_interface_value_change: 'change',
    player_location_change: 'Your location is now:',
    player_new_quest: 'You have a new quest:',
    player_new_item: 'You got new items:',
    player_lost_item: 'You lost items:',
    accept_ia_answer: 'Accept AI answer?',
    loading_message: 'Loading...',

}

async function loadOra() {
    ora = (await
        import ('ora')).default;
}

let spinner;

const enableDebug = false; // Set to true to enable debug mode
const enableAIDebug = false; // Set to true to enable debug mode for AI request/answer
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
            if (defaultInput != '' && input == '') {
                input = defaultInput;
            }
            resolve(input);
        });
    });
}

let possible_classes = [];

async function TranslateMenuText(language) {
    spinner = await ora("Translating...").start();
    spinner.start();
    let aiData = await aiFunction({
        args: {
            data: translateTextTable,
            to: language,
        },
        functionName: "translate_text",
        description: `Generate a translate dict from the "data" dict value from one language to another. Use the "to" arguments to specify destination language. The text is from a game user interface.`,
        funcReturn: "list[dict[index: str, value: str]]",
        showDebug: enableDebug,
        temperature: 0.7,
    });
    for (const [key, value] of Object.entries(aiData)) {
        translateTextTable[value.index] = value.value;
    }
    spinner.stop();
    return aiData;
}


async function TranslateText(text) {
    if (choosenLanguage == '' || choosenLanguage == 'en' || !translateMenu) {
        return text;
    }
    spinner = await ora("Translating...").start();
    spinner.start();
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
    spinner.stop();
    return aiData;
}

async function shortenSentence(sentence) {
    spinner = await ora(translateTextTable.loading_message).start();
    spinner.start();
    let aiData = await aiFunction({
        args: {
            sentence: sentence,
        },
        functionName: "shorten_sentence",
        description: "Rewrite the sentence to a minimum of words without breaking the context or important data. If the sentence can't be shorten, it will return the same sentence.",
        funcReturn: "str",
        temperature: 1,
    });
    spinner.stop();
    return aiData;
}

async function initializePlayerAttributes(gameState, playerClass, playerSex, playerDescription) {
    let prompt = fs.readFileSync('./prompt/generate_player_attributes.txt', 'utf8');
    spinner = await ora(translateTextTable.loading_message).start();
    spinner.start();
    aiData = await aiFunction({
        args: {
            gameSettings: gameState.gameSettings,
            playerDescription: playerDescription,
            playerSex: playerSex,
            playerClass: playerClass,
            playerLevel: 1,
        },
        functionName: "generate_player_attribut",
        description: prompt,
        funcReturn: "dict[hp, max_hp, mana, max_mana, money, attributes_list]",
        showDebug: enableDebug,
        autoConvertReturn: true,
        temperature: 0.7,
    });
    spinner.stop();
    if (aiData == null) {
        console.log(chalk.red(`####################`));
        console.log(chalk.red(`${translateTextTable.error}: ${aiData}`));
        console.log(chalk.red(`####################`));
        return [];
    }

    return aiData;
}

async function generateValidClass(gameState, playerDescription, playerSex) {
    let prompt = fs.readFileSync('./prompt/generate_random_classes.txt', 'utf8');
    spinner = await ora(translateTextTable.generating_class).start();
    spinner.start();
    aiData = await aiFunction({
        args: {
            gameSettings: gameState.gameSettings,
            playerDescription: playerDescription,
            playerSex: playerSex,
            playerLevel: 1,
        },
        functionName: "generate_player_class",
        description: prompt,
        funcReturn: "list[str]",
        showDebug: enableDebug,
        autoConvertReturn: true,
        temperature: 0.7,
    });
    spinner.stop();
    if (aiData == null) {
        console.log(chalk.red(`####################`));
        console.log(chalk.red(`${translateTextTable.error}: ${aiData}`));
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

// Function to generate narrative text
async function generateNarrativeText(gameState) {
    // Add your code here to call the AI and generate the narrative text based on the current choice
    let prompt = fs.readFileSync('./prompt/get_narrative_text.txt', 'utf8');
    spinner = await ora(translateTextTable.loading_message).start();
    spinner.start();
    aiData = await aiFunction({
        args: {
            current_choice: gameState.current_choice,
            text_history: gameState.text_history,
            playerData: gameState.playerData,
            gameSettings: gameState.gameSettings,
        },
        functionName: "generate_narrative_text",
        description: prompt,
        funcReturn: "dict[narrative_text:str, needPlayerUpdate:bool, needInventoryUpdate:bool, needLocationUpdate:bool, needQuestUpdate:bool, isGameOver:bool]",
        showDebug: enableDebug,
        temperature: 0.8,
        presence_penalty: 0.6,
    });
    spinner.stop();
    return aiData;
}

// Function to update inventory and stats
async function updateInventoryAndStats(gameState, narrativeText) {
    // Add your code here to call the AI and update the inventory and stats based on the generated narrative text
    let prompt = fs.readFileSync('./prompt/update_inventory_and_stats.txt', 'utf8');
    if (gameState.playerData.inventory == null || gameState.playerData.inventory.length == 0) {
        prompt += `\nVERY IMPORTANT: If the player has no inventory or an empty inventory, generate a set of inventory item for the start of the game (up to 10 items).
        Consider the gameSettings to adapt the items data such as language(ensure the output text matches the selected language), difficulty, game environment(e.g., cyberpunk, medieval, fantasy), and other settings.
        Example of item: 
        [{
        "name": "Knife",
        "count": 1,
        "type": "weapon",
        "value": 1,
        "equipped": true,
        }, ...]
        VERY IMPORTANT:  And generate a player "location" based on the narrativeText (home, forest, etc ...). 
        Example of location:
        {
            "location_name": "Home of the lawyer",
            "location_reason": "You are there for the quest given by your employer.",
            "location_type": "home",
            "location_sub": "Living Room",
        }
				`;
    }
    spinner = await ora(translateTextTable.loading_message).start();
    spinner.start();
    aiData = await aiFunction({
        args: {
            playerData: gameState.playerData,
            narrativeText: narrativeText,
            gameSettings: gameState.gameSettings,
        },
        functionName: "update_inventory_and_stats",
        description: prompt,
        funcReturn: "dict",
        showDebug: enableDebug,
        temperature: 0.8,
    });
    spinner.stop();
    return aiData;
}

async function generateGameScenario(gameState, player, playerScenario) {
    if (playerScenario != '') {
        // if (enableAIDebug) console.log(chalk.red(`[DEBUG] Generating base scenario for ${player.username} with user scenario:`) + chalk.green(`${playerScenario}`));
        spinner = await ora(translateTextTable.loading_message).start();
        spinner.start();
        baseScenario = await aiFunction({
            args: {
                gameSettings: gameState.gameSettings,
                playerData: {
                    username: player.username,
                    description: player.description,
                    attributes: player.attributes_list,
                    class: player.class,
                    sex: player.sex,
                    level: 1
                },
                main_idea: playerScenario,
            },
            functionName: "generate_player_scenario",
            description: `Generate a coherent text-based adventure game starting scenario for the player using the main idea, use the player level to determine the scenario. Use the gameSettings to modify game aspects like language (The output text must match the language selected), difficulty, game environment (cyberpunk, medieval, fantasy, etc.), and other settings. The scenario will be the start of the game, it's must be entertaining and coherent.`,
            funcReturn: "str",
            showDebug: enableDebug,
            temperature: 0.7,
        });
        spinner.stop();
        // if (enableAIDebug) console.log(chalk.red(`[DEBUG] Generated scenario: `) + chalk.green(`${baseScenario}`));
    } else {
        // if (enableAIDebug) console.log(chalk.red(`[DEBUG] Generating base scenario for ${player.username}`));
        spinner = await ora(translateTextTable.loading_message).start();
        spinner.start();
        baseScenario = await aiFunction({
            args: {
                gameSettings: gameState.gameSettings,
                playerData: {
                    username: player.username,
                    description: player.description,
                    attributes: player.attributes_list,
                    class: player.class,
                    sex: player.sex
                }
            },
            functionName: "generate_player_scenario",
            description: "Generate a coherent text-based adventure game starting scenario for the player (The player data can be used for the scenario), use the player level to determine the scenario. Use the gameSettings to modify game aspects like language (The output text must match the language selected), difficulty, game environment (cyberpunk, medieval, fantasy, etc.), and other settings. The scenario will be the start of the game, it's must be entertaining and coherent.",
            funcReturn: "str",
            showDebug: enableDebug,
            temperature: 0.7,
        });
        spinner.stop();
        // if (enableAIDebug) console.log(chalk.red(`[DEBUG] Generated scenario: `) + chalk.green(`${baseScenario}`));
    }
    return baseScenario;
}

// Function to generate possible choices
async function generatePossibleChoices(gameState, narrativeText) {
    const prompt = fs.readFileSync('./prompt/generate_narrative_choices.txt', 'utf8');
    // Add your code here to call the AI and generate possible choices based on the generated narrative text
    spinner = await ora(translateTextTable.loading_message).start();
    spinner.start();
    aiData = await aiFunction({
        args: {
            playerData: gameState.playerData,
            narrativeText: narrativeText,
            gameSettings: gameState.gameSettings,
        },
        functionName: "generate_narrative_choices",
        description: prompt,
        funcReturn: "list[str]",
        showDebug: enableDebug,
        temperature: 0.8,
    });
    spinner.stop();
    return aiData;
}

function syncInventoryAndStats(updatedInventoryStats, gameState) {
    if (updatedInventoryStats.player.inventory) {
        gameState.playerData.inventory = updatedInventoryStats.player.inventory;
    }
    if (updatedInventoryStats.player.hp) {
        gameState.playerData.hp = updatedInventoryStats.player.hp;
    }
    if (updatedInventoryStats.player.max_hp) {
        gameState.playerData.max_hp = updatedInventoryStats.player.max_hp;
    }
    if (updatedInventoryStats.player.money) {
        gameState.playerData.money = updatedInventoryStats.player.money;
    }
    if (updatedInventoryStats.player.mana) {
        gameState.playerData.mana = updatedInventoryStats.player.mana;
    }
    if (updatedInventoryStats.player.max_mana) {
        gameState.playerData.max_mana = updatedInventoryStats.player.max_mana;
    }
    if (updatedInventoryStats.player.exp) {
        gameState.playerData.exp = updatedInventoryStats.player.exp;
    }
    if (updatedInventoryStats.player.next_level_exp) {
        gameState.playerData.next_level_exp = updatedInventoryStats.player.next_level_exp;
    }

    if (updatedInventoryStats.player.level) {
        gameState.playerData.level = updatedInventoryStats.player.level;
    }

    if (updatedInventoryStats.player.location) {
        gameState.playerData.location = updatedInventoryStats.player.location;
    }

    if (updatedInventoryStats.player.quest) {
        gameState.playerData.quest = updatedInventoryStats.player.quest;
    }

    return gameState;
}
async function showNewItemsAndStats(updatedInventoryStats, gameState) {
    const logIfChanged = (oldValue, newValue, message, calculationMessage = null) => {
        if (newValue && newValue != oldValue) {
            const outputMessage = calculationMessage ?
                `${message} (${calculationMessage})` :
                message;
            console.log(chalk.green(outputMessage));
        }
    };

    const newPlayer = updatedInventoryStats.player;
    const oldPlayer = gameState.playerData;
    if (newPlayer) {
        logIfChanged(oldPlayer.level, newPlayer.level, `>>> ${translateTextTable.player_level_change} ${newPlayer.level}`);
        logIfChanged(oldPlayer.hp, newPlayer.hp, `>>> ${translateTextTable.player_hp_change} ${newPlayer.hp}/${oldPlayer.max_hp}`, translateTextTable.player_interface_value_change + `: ${newPlayer.hp - oldPlayer.hp}`);
        logIfChanged(oldPlayer.mana, newPlayer.mana, `>>> ${translateTextTable.player_mana_change} ${newPlayer.mana}/${oldPlayer.max_mana}`, translateTextTable.player_interface_value_change + `: ${newPlayer.mana - oldPlayer.mana}`);
        logIfChanged(oldPlayer.exp, newPlayer.exp, `>>> ${translateTextTable.player_exp_change} ${newPlayer.exp}`, translateTextTable.player_interface_value_change + `: ${newPlayer.exp - oldPlayer.exp}`);
        logIfChanged(oldPlayer.next_level_exp, newPlayer.next_level_exp, `>>> ${translateTextTable.player_next_level_exp_change} ${newPlayer.next_level_exp}`);
        logIfChanged(oldPlayer.money, newPlayer.money, `>>> ${translateTextTable.player_money_change} ${newPlayer.money}`, translateTextTable.player_interface_value_change + `: ${newPlayer.money - oldPlayer.money}`);
    }

    const newLocation = newPlayer.location;
    const oldLocation = oldPlayer.location;

    if (newLocation) {
        logIfChanged(oldLocation.location_name, newLocation.location_name, `>>> ${translateTextTable.player_location_change} ${newLocation.location_name}`);
        logIfChanged(oldLocation.location_reason, newLocation.location_reason, `>>> Location Reason: ${newLocation.location_reason}`);
        logIfChanged(oldLocation.location_type, newLocation.location_type, `>>> Location Type: ${newLocation.location_type}`);
        logIfChanged(oldLocation.location_sub, newLocation.location_sub, `>>> Location Sublocation: ${newLocation.location_sub}`);
    }

    const newQuest = newPlayer.quest;
    const oldQuest = oldPlayer.quest;

    if (newQuest) {
        logIfChanged(oldQuest.quest_name, newQuest.quest_name, `>>> ${translateTextTable.player_new_quest} ${newQuest.quest_name}`);
        logIfChanged(oldQuest.quest_description, newQuest.quest_description, `>>> Quest Description: ${newQuest.quest_description}`);
        logIfChanged(oldQuest.quest_status, newQuest.quest_status, `>>> Quest Status: ${newQuest.quest_status}`);
        logIfChanged(oldQuest.quest_type, newQuest.quest_type, `>>> Quest Type: ${newQuest.quest_type}`);
        logIfChanged(oldQuest.quest_reward, newQuest.quest_reward, `>>> Quest Reward: ${newQuest.quest_reward}`);
    }
    // Show new items and the count from inventory if the player has new items and show removed items if the player has lost items
    if (updatedInventoryStats.player && updatedInventoryStats.player.inventory) {
        let newItems = [];
        let removedItems = [];
        let inventory = updatedInventoryStats.player.inventory;
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
            console.log(chalk.yellow(`>>> ${translateTextTable.player_new_item} `) + `${newItems.map(item => `${item.count} ${item.name}`).join(', ')}`);
           }
           if (removedItems.length > 0) {
               console.log(chalk.red(`>>> ${translateTextTable.player_lost_item}`) + `${removedItems.map(item => `${item.count} ${item.name}`).join(', ')}`);
           }
       }
}


async function main() {
    await loadOra();
    spinner = await ora(translateTextTable.loading_message).start();
    spinner.stop(); 
    console.log(chalk.red(`############################`));
    console.log(chalk.red(`## Generate Your Own Game ##`));
    console.log(chalk.red(`############################`));
    let prompt = fs.readFileSync('./prompt/game_prompt.txt', 'utf8');
    const gameLanguage = await getUserInput('Choose the language of the game (en, fr, etc.)', false, 'en');
    if (gameLanguage != 'en') 
    {
        const translateMenuAsk = await getUserInput('Do you want to translate the menu of the game? (yes/no)', false, 'no');
        translateMenu = (translateMenuAsk == 'yes' || translateMenuAsk == 'y') ? true : false;
        if (translateMenu) await TranslateMenuText(gameLanguage);
    }
    choosenLanguage = gameLanguage;
    const username = await getUserInput(translateTextTable.choose_player_username, false, 'Jack');
    const gameEnvironment = await getUserInput(translateTextTable.choose_game_environment, false, translateTextTable.choose_game_environment_default);
    const playerScenario = await getUserInput(translateTextTable.choose_player_scenario, false, '');
    const gameDifficulty = await getUserInput(translateTextTable.choose_game_difficulty, false, translateTextTable.choose_game_difficulty_default);
    const playerSex = await getUserInput(translateTextTable.choose_player_sex, false, translateTextTable.choose_player_sex_default);
    const description = await getUserInput(translateTextTable.choose_player_description, false, translateTextTable.choose_player_description_default);

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
        ...await initializePlayerAttributes(gameState, playerClass, playerSex, description),
    };
    let baseScenario;

    baseScenario = await generateGameScenario(gameState, player, playerScenario);

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
            next_level_exp: 100,
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
                "quest_status": "Not Started",
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
    if (enableAIDebug) console.log(chalk.red(`[DEBUG] Send inventory and stats data: `) + chalk.green(`${JSON.stringify(gameState.playerData)}`));
    let startupdatedInventoryStats = await updateInventoryAndStats(gameState, baseScenario);
    if (enableAIDebug) console.log(chalk.red(`[DEBUG] Updated inventory and stats: `) + chalk.green(`${JSON.stringify(startupdatedInventoryStats)}`));
    await showNewItemsAndStats(startupdatedInventoryStats, gameState);
    gameState = syncInventoryAndStats(startupdatedInventoryStats, gameState);

    while (true) {
        let currentChoice;
        let updatedInventoryStats;
        let narrativeText;
        let updateInventory;
        try {
            let description = prompt;
            currentChoice = gameState.current_choice;
            // Step 1: Generate narrative text
            // if (enableAIDebug) console.log(gameState);
            const narrativeTextRequest = await generateNarrativeText(gameState);
            narrativeText = narrativeTextRequest.narrative_text;
            // console.log(narrativeText);
            // while (narrativeText == '') {
            //     if (enableAIDebug) console.log(chalk.red(`[DEBUG] Narrative text is empty, generating new narrative text...`));
            //     narrativeText = await generateNarrativeText(gameState);
            // }
            if (enableAIDebug) {
                console.log(chalk.red(`[DEBUG] Narrative text: `) + chalk.green(`${JSON.stringify(narrativeTextRequest)}`));
            }
            console.log("\nNarrative: " + chalk.cyan(narrativeText));
            updateInventory = narrativeTextRequest.needPlayerUpdate || narrativeTextRequest.needInventoryUpdate || narrativeTextRequest.needLocationUpdate || narrativeTextRequest.needQuestUpdate || (gameState.playerData.inventory == null || gameState.playerData.inventory.length == 0);
            // Step 2: Update inventory and stats
            if (updateInventory) {
                if (enableAIDebug) console.log(chalk.red(`[DEBUG] Send inventory and stats data: `) + chalk.green(`${JSON.stringify(gameState.playerData)}`));
                updatedInventoryStats = await updateInventoryAndStats(gameState, narrativeText);
                if (enableAIDebug) console.log(chalk.red(`[DEBUG] Updated inventory and stats: `) + chalk.green(`${JSON.stringify(updatedInventoryStats)}`));
            } else {
                if (enableAIDebug) console.log(chalk.red(`[DEBUG] No need to update inventory and stats`));
            }
            spinner.stop();

            // // Step 3: Generate possible choices
            // const possibleChoices = await generatePossibleChoices(gameState, narrativeText);

        } catch (error) {
            spinner.stop(); 
            console.log(error);
            continue;
        }
        if (updateInventory) {
            if (!updatedInventoryStats.player || !updatedInventoryStats.player.inventory || !updatedInventoryStats.player.inventory[0] || !updatedInventoryStats.player.inventory[0].name) {
                if (enableAIDebug) console.log(chalk.red(`[DEBUG] Incorrect player data, re-generating ...`));
                continue;
            }
            await showNewItemsAndStats(updatedInventoryStats, gameState);
        }
		const acceptIAAnswer = await getUserInput(chalk.magenta(translateTextTable.accept_ia_answer + ' (y/n) '));
		if (acceptIAAnswer.toLowerCase() != 'y') {
            console.log(' ');
			continue;
		}

        if (updateInventory) gameState = syncInventoryAndStats(updatedInventoryStats, gameState);
        
        // // Step 3: Generate possible choices
        const possibleChoices = await generatePossibleChoices(gameState, narrativeText);
        // console.log(possibleChoices);
        let userInput;
        if (possibleChoices.length > 0) {
            possibleChoices.forEach((choice, index) => {
                console.log(chalk.yellow(`${index + 1}: ${choice}`));
            });
            userInput = await getUserInput(chalk.magenta(translateTextTable.select_player_action));
            // Use the userInput if user input is valid (between 1 and possibleChoices.length) otherwise use the userInput as text
            userInput = userInput >= 1 && userInput <= possibleChoices.length ? possibleChoices[userInput - 1] : userInput;
        } else {
            userInput = await getUserInput(chalk.magenta(translateTextTable.select_player_action_custom));
        }

        console.log(' ');
    

		gameState.text_history.push({
			narrative_text: await shortenSentence(currentChoice.narrative_text),
			user_choice: currentChoice.user_choice,
		});
		

		gameState.current_choice = {
			narrative_text: narrativeText,
			user_choice: userInput,
		};

        if (gameState.text_history.length > 7) {
            gameState.text_history.shift();
        }


        // if (aiData.game_over) {
        //     break;
        // }
    }

    rl.close();


}
main();