// deploy-commands.js
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const dotenv = require('dotenv');

dotenv.config();

const commands = [
  new SlashCommandBuilder()
    .setName('commandes')
    .setDescription('Affiche les statistiques des commandes actuelles'),
  
  new SlashCommandBuilder()
    .setName('commandes-jour')
    .setDescription('Affiche les commandes du jour'),
  
  new SlashCommandBuilder()
    .setName('aide')
    .setDescription('Affiche les instructions d\'utilisation du bot')
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Déploiement des commandes slash...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('Les commandes slash ont été déployées avec succès !');
  } catch (error) {
    console.error('Erreur lors du déploiement des commandes :', error);
  }
})();