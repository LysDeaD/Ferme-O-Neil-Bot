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
].map(cmd => cmd.toJSON()); // ← ajout pour corriger l'objet

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function deployCommands() {
  try {
    console.log('Déploiement des commandes slash...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );
    console.log('✅ Les commandes slash ont été déployées avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors du déploiement des commandes :', error);
  }
}

// Permet de l’exécuter manuellement avec "node deploy-commands.js"
if (require.main === module) {
  deployCommands();
}

// Export pour pouvoir l'appeler dans ton bot
module.exports = { deployCommands };
