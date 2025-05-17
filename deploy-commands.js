// deploy-commands.js
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

// Définition complète de toutes les commandes slash
const commands = [
  // Commande d'aide
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Affiche la liste des commandes disponibles'),
  
  // Statistiques de commandes avec filtres
  new SlashCommandBuilder()
    .setName('commandes')
    .setDescription('Affiche les statistiques des commandes')
    .addStringOption(option =>
      option.setName('statut')
        .setDescription('Filtre par statut (optionnel)')
        .setRequired(false)
        .addChoices(
          { name: 'En attente', value: 'En attente' },
          { name: 'Acceptées', value: 'Acceptée' },
          { name: 'En préparation', value: 'En préparation' },
          { name: 'Terminées', value: 'Terminée' },
          { name: 'En livraison', value: 'En attente de livraison' },
          { name: 'Livrées', value: 'Livrée' },
          { name: 'Toutes', value: 'toutes' }
        )),
  
  // Recherche de commande
  new SlashCommandBuilder()
    .setName('recherche')
    .setDescription('Recherche une commande par son ID ou le nom du client')
    .addStringOption(option =>
      option.setName('terme')
        .setDescription('ID de commande ou nom de client')
        .setRequired(true)),
  
  // Statistiques par période
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Affiche les statistiques des commandes')
    .addStringOption(option =>
      option.setName('période')
        .setDescription('Période de temps pour les statistiques')
        .setRequired(false)
        .addChoices(
          { name: 'Aujourd\'hui', value: 'jour' },
          { name: 'Cette semaine', value: 'semaine' },
          { name: 'Ce mois', value: 'mois' },
          { name: 'Total', value: 'total' }
        )),
  
  // Top clients
  new SlashCommandBuilder()
    .setName('topclients')
    .setDescription('Affiche les meilleurs clients')
    .addIntegerOption(option =>
      option.setName('nombre')
        .setDescription('Nombre de clients à afficher')
        .setRequired(false)),
  
  // Top produits
  new SlashCommandBuilder()
    .setName('topproduits')
    .setDescription('Affiche les produits les plus vendus')
    .addIntegerOption(option =>
      option.setName('nombre')
        .setDescription('Nombre de produits à afficher')
        .setRequired(false))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function deployCommands() {
  try {
    console.log('Déploiement des commandes slash...');
    
    if (process.env.GUILD_ID) {
      // Déploiement des commandes pour un serveur spécifique (développement)
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );
      console.log(`✅ Les commandes slash ont été déployées avec succès pour le serveur ${process.env.GUILD_ID} !`);
    } else {
      // Déploiement global des commandes (production)
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log('✅ Les commandes slash ont été déployées globalement avec succès ! (peut prendre jusqu\'à une heure pour se propager)');
    }
  } catch (error) {
    console.error('❌ Erreur lors du déploiement des commandes :', error);
  }
}

// Permet l'exécution manuelle avec "node deploy-commands.js"
if (require.main === module) {
  deployCommands();
}

// Export pour pouvoir l'appeler depuis le bot
module.exports = { deployCommands };