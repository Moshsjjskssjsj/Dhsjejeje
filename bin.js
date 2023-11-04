const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');

const botToken = '6550873983:AAFg0DQTfz7Y-apfe_l-L0ccQ7vQEtewi1c'; // Replace with your Telegram Bot token
const binlistApiUrl = 'https://lookup.binlist.net/';

// Initialize the Telegram bot
const bot = new TelegramBot(botToken, { polling: true });

// Handle the /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome to the BIN Lookup Bot! Please send a text file containing one or more BINs.');
});

// Handle file uploads
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;

  if (msg.document) {
    const fileId = msg.document.file_id;
    const file = await bot.getFile(fileId);

    // Download the file
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
    const fileName = file.file_name;

    try {
      const response = await axios.get(fileUrl, { responseType: 'stream' });
      const filePath = `./${fileName}`;
      const writeStream = fs.createWriteStream(filePath);

      response.data.pipe(writeStream);

      writeStream.on('finish', () => {
        // Read the BINs from the file
        const binData = fs.readFileSync(filePath, 'utf-8').split('\n').map((bin) => bin.trim());

        // Look up BIN details and send responses with a 3-second delay between requests
        lookupBinsWithDelay(chatId, binData);

        // Delete the file
        fs.unlinkSync(filePath);
      });
    } catch (error) {
      bot.sendMessage(chatId, 'Error: Failed to process the file.');
    }
  }
});

// Function to lookup and send details for all stored BINs with a delay
async function lookupBinsWithDelay(chatId, bins) {
  if (bins.length === 0) {
    bot.sendMessage(chatId, 'No BINs to lookup.');
    return;
  }

  let index = 0;

  function sendNextBin() {
    if (index < bins.length) {
      const bin = bins[index];
      try {
        // Make an API request to the binlist API
        axios.get(`${binlistApiUrl}${bin}`)
          .then((response) => {
            const binData = response.data;
            // Send the BIN details back to the user
            bot.sendMessage(chatId, `BIN: ${bin}\nBrand: ${binData.brand}\nBank: ${binData.bank.name}\nCountry: ${binData.country.name}`);
          })
          .catch((error) => {
            bot.sendMessage(chatId, `Error: BIN ${bin} not found or invalid.`);
          })
          .finally(() => {
            // Move to the next BIN with a delay
            index++;
            setTimeout(sendNextBin, 3000); // 3-second delay
          });
      } catch (error) {
        bot.sendMessage(chatId, 'Error: Failed to process the BINs.');
      }
    }
  }

  // Start the process
  sendNextBin();
}
  