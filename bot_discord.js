// bot_discord.js - Bot Discord pour O'Neil Farm
const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');

// Chargement des variables d'environnement
dotenv.config();

// Modèles
const Commande = require('./models/commande');

// Configuration du bot Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// Configuration du serveur Express
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 3000;

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connecté à MongoDB'))
  .catch(err => console.error('Erreur de connexion à MongoDB:', err));

// Fonctions de notification pour le bot Discord
async function notifierClient(commande) {
  try {
    const embedClient = creerEmbedCommande(commande, commande.status);
    return await envoyerMessagePrive(commande.discordId, embedClient);
  } catch (error) {
    console.error('Erreur lors de la notification du client:', error);
    return false;
  }
}

async function notifierFermiers(commande) {
  try {
    const canalFermiers = client.channels.cache.get(process.env.CHANNEL_ID_FERMIERS);
    if (!canalFermiers) {
      console.error('Canal des fermiers non trouvé');
      return false;
    }
    
    const { embed, row } = creerEmbedFermiers(commande);
    await canalFermiers.send({ embeds: [embed], components: [row] });
    return true;
  } catch (error) {
    console.error('Erreur lors de la notification des fermiers:', error);
    return false;
  }
}

// Importer et configurer les routes
const commandesRoutes = require('./routes/commandes');
commandesRoutes.initialiserNotifications(notifierClient, notifierFermiers);
app.use('/api/commandes', commandesRoutes.router);

// Événement quand le bot est prêt
client.once('ready', () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);
  console.log(`Serveur d'API démarré sur le port ${PORT}`);
});

// Fonction pour envoyer un message privé à un utilisateur
async function envoyerMessagePrive(userId, embed) {
  try {
    const user = await client.users.fetch(userId);
    await user.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error(`Erreur lors de l'envoi du message privé: ${error}`);
    return false;
  }
}

// Fonction pour créer un embed de commande
function creerEmbedCommande(commande, status) {
  const embed = new EmbedBuilder()
    .setColor('#4B6B31')
    .setTitle(`Commande #${commande._id.toString().slice(-6)} - ${status}`)
    .setDescription('Ferme O\'Neil - Suivi de commande')
    .setThumbnail('https://imagizer.imageshack.com/img922/9711/6bGvep.png') // À remplacer par votre logo
    .addFields(
      { name: 'Client', value: commande.nom, inline: true },
      { name: 'Téléphone', value: commande.telephone, inline: true },
      { name: 'Discord ID', value: commande.discordId, inline: true },
      { name: 'Total', value: `${commande.total.toFixed(2)} $`, inline: true },
      { name: 'Date', value: new Date(commande.dateCommande).toLocaleString('fr-FR'), inline: true },
      { name: 'Statut', value: status, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: 'Ferme O\'Neil - Merci pour votre commande!' });

  // Ajouter la liste des produits
  let produitsText = '';
  commande.produits.forEach(produit => {
    if (produit.quantite > 0) {
      produitsText += `${produit.nom}: ${produit.quantite} x ${produit.prix}$ = ${(produit.quantite * produit.prix).toFixed(2)}$\n`;
    }
  });
  
  if (produitsText) {
    embed.addFields({ name: 'Produits commandés', value: produitsText });
  }

  // Ajouter le commentaire s'il existe
  if (commande.commentaire) {
    embed.addFields({ name: 'Commentaire', value: commande.commentaire });
  }

  return embed;
}

// Fonction pour créer un embed de notification pour les fermiers
function creerEmbedFermiers(commande) {
  const embed = creerEmbedCommande(commande, commande.status);
  
  // Ajouter des boutons pour changer le statut
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`accepter_${commande._id}`)
        .setLabel('Accepter')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`preparer_${commande._id}`)
        .setLabel('En préparation')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`terminer_${commande._id}`)
        .setLabel('Terminée')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`livraison_${commande._id}`)
        .setLabel('En livraison')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`livree_${commande._id}`)
        .setLabel('Livrée')
        .setStyle(ButtonStyle.Success)
    );

  return { embed, row };
}

// Traitement des interactions (boutons)
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const [action, commandeId] = interaction.customId.split('_');
  
  try {
    const commande = await Commande.findById(commandeId);
    if (!commande) {
      return await interaction.reply({ content: 'Commande introuvable', ephemeral: true });
    }

    let nouveauStatus = '';
    switch (action) {
      case 'accepter':
        nouveauStatus = 'Acceptée';
        break;
      case 'preparer':
        nouveauStatus = 'En préparation';
        break;
      case 'terminer':
        nouveauStatus = 'Terminée';
        break;
      case 'livraison':
        nouveauStatus = 'En attente de livraison';
        break;
      case 'livree':
        nouveauStatus = 'Livrée';
        break;
      default:
        return await interaction.reply({ content: 'Action non reconnue', ephemeral: true });
    }

    // Mettre à jour le statut de la commande et ajouter le nom du fermier qui traite
    await commande.updateStatus(nouveauStatus, interaction.user.tag);

    // Notifier le client
    await notifierClient(commande);

    // Mettre à jour l'embed dans le canal des fermiers
    const { embed, row } = creerEmbedFermiers(commande);
    await interaction.update({ embeds: [embed], components: [row] });
    
    // Confirmation au fermier qui a cliqué sur le bouton
    await interaction.followUp({ content: `Statut de la commande #${commande._id.toString().slice(-6)} mis à jour: ${nouveauStatus}`, ephemeral: true });
    
  } catch (error) {
    console.error(`Erreur lors du traitement de l'interaction: ${error}`);
    await interaction.reply({ content: 'Une erreur est survenue lors du traitement de votre demande.', ephemeral: true });
  }
});

// Route pour servir le frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Commandes slash pour les statistiques
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'commandes') {
    try {
      const commandesEnAttente = await Commande.getCommandesParStatut('En attente');
      const commandesEnPreparation = await Commande.getCommandesParStatut('En préparation');
      const commandesTerminees = await Commande.getCommandesParStatut('Terminée');
      
      const embed = new EmbedBuilder()
        .setColor('#4B6B31')
        .setTitle('Statistiques des commandes')
        .setDescription('État actuel des commandes de la Ferme O\'Neil')
        .addFields(
          { name: 'En attente', value: commandesEnAttente.length.toString(), inline: true },
          { name: 'En préparation', value: commandesEnPreparation.length.toString(), inline: true },
          { name: 'Terminées', value: commandesTerminees.length.toString(), inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Ferme O\'Neil - Système de commandes' });
      
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      await interaction.reply({ content: 'Une erreur est survenue lors de la récupération des statistiques.', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Serveur d'API démarré sur le port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("Erreur de connexion du bot Discord:", err);
  });