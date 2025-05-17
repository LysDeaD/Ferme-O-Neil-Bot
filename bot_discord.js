// bot_discord.js - Bot Discord pour O'Neil Farm
const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, SlashCommandBuilder, Routes } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');
const { deployCommands } = require('./deploy-commands');

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
app.use(cors({
  origin: '*', // Permet toutes les origines
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Ajouter cette ligne pour gérer les requêtes OPTIONS (preflight)
app.options('*', cors());

// Middleware pour logger les requêtes et leurs origines
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  console.log(`Origine de la requête: ${req.headers.origin || 'Inconnue'}`);
  console.log(`User-Agent: ${req.headers['user-agent']}`);
  next();
});

// Ajoutez également une route de test CORS
app.get('/api/test-cors', (req, res) => {
  res.json({ message: 'Test CORS réussi!' });
});

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 3000;

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connecté à MongoDB'))
  .catch(err => console.error('Erreur de connexion à MongoDB:', err));

// Surveiller les événements de connexion MongoDB
mongoose.connection.on('connected', () => {
  console.log('Mongoose connecté à MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Erreur de connexion Mongoose:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose déconnecté de MongoDB');
});

// Ajouter un middleware pour logger les requêtes entrantes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Ajouter ce middleware de gestion d'erreurs à la fin du fichier, juste avant app.listen
app.use((err, req, res, next) => {
  console.error('Erreur Express:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Erreur serveur', 
    error: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

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

  // Ajouter l'information sur l'employé en charge si disponible
  if (commande.traitePar) {
    embed.addFields({ name: 'Employé en charge', value: commande.traitePar, inline: true });
  }

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

// Client ready event
client.once('ready', () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);
  deployCommands(); // Déployer les commandes slash
  console.log(`Serveur d'API démarré sur le port ${PORT}`);
});

// Gestionnaire de commandes slash
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  try {
    // Commande /help
    if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setColor('#4B6B31')
        .setTitle('Aide - Commandes du Bot O\'Neil Farm')
        .setDescription('Voici la liste des commandes disponibles:')
        .addFields(
          { name: '/help', value: 'Affiche cette liste de commandes' },
          { name: '/commandes [statut]', value: 'Affiche les statistiques des commandes avec filtre optionnel par statut' },
          { name: '/recherche <terme>', value: 'Recherche une commande par ID ou nom de client' },
          { name: '/stats [période]', value: 'Affiche les statistiques des commandes (jour/semaine/mois/total)' },
          { name: '/topclients [nombre]', value: 'Liste les meilleurs clients par montant total d\'achats' },
          { name: '/topproduits [nombre]', value: 'Liste les produits les plus vendus' }
        )
        .setTimestamp()
        .setFooter({ text: 'Ferme O\'Neil - Système de commandes' });
      
      await interaction.reply({ embeds: [embed] });
    }

    // Commande /commandes améliorée
    else if (commandName === 'commandes') {
      const statut = interaction.options.getString('statut');
      let commandesData;
      let titre;
      
      if (statut && statut !== 'toutes') {
        commandesData = await Commande.getCommandesParStatut(statut);
        titre = `Commandes - ${statut}`;
      } else {
        titre = 'Statistiques des commandes';
        // Récupérer les statistiques pour tous les statuts
        const enAttente = await Commande.getCommandesParStatut('En attente');
        const acceptees = await Commande.getCommandesParStatut('Acceptée');
        const enPreparation = await Commande.getCommandesParStatut('En préparation');
        const terminees = await Commande.getCommandesParStatut('Terminée');
        const enLivraison = await Commande.getCommandesParStatut('En attente de livraison');
        const livrees = await Commande.getCommandesParStatut('Livrée');
        
        const embed = new EmbedBuilder()
          .setColor('#4B6B31')
          .setTitle(titre)
          .setDescription('État actuel des commandes de la Ferme O\'Neil')
          .addFields(
            { name: 'En attente', value: enAttente.length.toString(), inline: true },
            { name: 'Acceptées', value: acceptees.length.toString(), inline: true },
            { name: 'En préparation', value: enPreparation.length.toString(), inline: true },
            { name: 'Terminées', value: terminees.length.toString(), inline: true },
            { name: 'En livraison', value: enLivraison.length.toString(), inline: true },
            { name: 'Livrées', value: livrees.length.toString(), inline: true },
            { name: 'Total', value: (enAttente.length + acceptees.length + enPreparation.length + terminees.length + enLivraison.length + livrees.length).toString(), inline: false }
          )
          .setTimestamp()
          .setFooter({ text: 'Ferme O\'Neil - Système de commandes' });
        
        await interaction.reply({ embeds: [embed] });
        return;
      }
      
      // Afficher la liste des commandes filtrées
      if (commandesData.length === 0) {
        await interaction.reply(`Aucune commande avec le statut "${statut}" trouvée.`);
        return;
      }
      
      // Si trop de commandes, limiter l'affichage
      const commandesAffichees = commandesData.slice(0, 10);
      
      const embed = new EmbedBuilder()
        .setColor('#4B6B31')
        .setTitle(titre)
        .setDescription(`${commandesData.length} commande(s) trouvée(s)${commandesData.length > 10 ? ' (10 premières affichées)' : ''}`)
        .setTimestamp()
        .setFooter({ text: 'Ferme O\'Neil - Système de commandes' });
      
      // Ajouter les commandes trouvées
      commandesAffichees.forEach((cmd, index) => {
        embed.addFields({
          name: `#${cmd._id.toString().slice(-6)} - ${cmd.nom}`,
          value: `Status: ${cmd.status} | Date: ${new Date(cmd.dateCommande).toLocaleString('fr-FR')} | Total: ${cmd.total.toFixed(2)}$`
        });
      });
      
      await interaction.reply({ embeds: [embed] });
    }

    // Commande /recherche
    else if (commandName === 'recherche') {
      const terme = interaction.options.getString('terme');
      let commandes;
      
      // Si le terme ressemble à un ID (6 derniers caractères)
      if (/^\d{6}$/.test(terme)) {
        // Recherche par les 6 derniers caractères de l'ID
        const tousCommandes = await Commande.find();
        commandes = tousCommandes.filter(cmd => cmd._id.toString().slice(-6) === terme);
      } else {
        // Recherche par nom (insensible à la casse)
        commandes = await Commande.find({
          nom: { $regex: terme, $options: 'i' }
        }).sort({ dateCommande: -1 }).limit(10);
      }
      
      if (commandes.length === 0) {
        await interaction.reply(`Aucune commande trouvée pour "${terme}".`);
        return;
      }
      
      const embed = new EmbedBuilder()
        .setColor('#4B6B31')
        .setTitle('Résultats de recherche')
        .setDescription(`${commandes.length} commande(s) trouvée(s) pour "${terme}"`)
        .setTimestamp()
        .setFooter({ text: 'Ferme O\'Neil - Système de commandes' });
      
      commandes.forEach(cmd => {
        embed.addFields({
          name: `#${cmd._id.toString().slice(-6)} - ${cmd.nom}`,
          value: `Status: ${cmd.status} | Date: ${new Date(cmd.dateCommande).toLocaleString('fr-FR')} | Total: ${cmd.total.toFixed(2)}$`
        });
      });
      
      await interaction.reply({ embeds: [embed] });
    }

    // Commande /stats
    else if (commandName === 'stats') {
      const periode = interaction.options.getString('période') || 'jour';
      let dateDebut = new Date();
      let titre = '';
      
      // Déterminer la période
      switch (periode) {
        case 'jour':
          dateDebut.setHours(0, 0, 0, 0);
          titre = 'Statistiques du jour';
          break;
        case 'semaine':
          dateDebut.setDate(dateDebut.getDate() - dateDebut.getDay());
          dateDebut.setHours(0, 0, 0, 0);
          titre = 'Statistiques de la semaine';
          break;
        case 'mois':
          dateDebut.setDate(1);
          dateDebut.setHours(0, 0, 0, 0);
          titre = 'Statistiques du mois';
          break;
        case 'total':
          dateDebut = new Date(0); // 1970
          titre = 'Statistiques totales';
          break;
      }
      
      // Récupérer les commandes de la période
      const dateFin = new Date();
      dateFin.setHours(23, 59, 59, 999);
      
      const commandes = await Commande.find({
        dateCommande: {
          $gte: dateDebut,
          $lte: dateFin
        }
      });
      
      // Calculer les statistiques
      const totalCommandes = commandes.length;
      const totalVentes = commandes.reduce((sum, cmd) => sum + cmd.total, 0);
      const commandesParStatut = {};
      
      // Compter les commandes par statut
      commandes.forEach(cmd => {
        if (!commandesParStatut[cmd.status]) {
          commandesParStatut[cmd.status] = 0;
        }
        commandesParStatut[cmd.status]++;
      });
      
      // Créer l'embed
      const embed = new EmbedBuilder()
        .setColor('#4B6B31')
        .setTitle(titre)
        .setDescription(`Statistiques des commandes de la Ferme O'Neil`)
        .addFields(
          { name: 'Nombre de commandes', value: totalCommandes.toString(), inline: true },
          { name: 'Montant total', value: `${totalVentes.toFixed(2)}$`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Ferme O\'Neil - Système de commandes' });
      
      // Ajouter les statuts
      for (const [statut, nombre] of Object.entries(commandesParStatut)) {
        embed.addFields({ name: statut, value: nombre.toString(), inline: true });
      }
      
      await interaction.reply({ embeds: [embed] });
    }

    // Commande /topclients
    else if (commandName === 'topclients') {
      const nombre = interaction.options.getInteger('nombre') || 5;
      
      // Agréger les commandes par client
      const commandes = await Commande.find();
      const clientsMap = new Map();
      
      commandes.forEach(cmd => {
        const key = `${cmd.discordId}:${cmd.nom}`;
        if (!clientsMap.has(key)) {
          clientsMap.set(key, { nom: cmd.nom, total: 0, commandes: 0 });
        }
        
        const client = clientsMap.get(key);
        client.total += cmd.total;
        client.commandes++;
      });
      
      // Trier les clients par total d'achats
      const clientsTriés = Array.from(clientsMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, nombre);
      
      if (clientsTriés.length === 0) {
        await interaction.reply('Aucun client trouvé.');
        return;
      }
      
      const embed = new EmbedBuilder()
        .setColor('#4B6B31')
        .setTitle('Top Clients')
        .setDescription(`Les ${nombre} meilleurs clients de la Ferme O'Neil`)
        .setTimestamp()
        .setFooter({ text: 'Ferme O\'Neil - Système de commandes' });
      
      clientsTriés.forEach((client, index) => {
        embed.addFields({
          name: `#${index + 1} - ${client.nom}`,
          value: `Total: ${client.total.toFixed(2)}$ | Commandes: ${client.commandes}`
        });
      });
      
      await interaction.reply({ embeds: [embed] });
    }

    // Commande /topproduits
    else if (commandName === 'topproduits') {
      const nombre = interaction.options.getInteger('nombre') || 5;
      
      // Agréger les produits de toutes les commandes
      const commandes = await Commande.find();
      const produitsMap = new Map();
      
      commandes.forEach(cmd => {
        cmd.produits.forEach(produit => {
          if (produit.quantite <= 0) return;
          
          if (!produitsMap.has(produit.id)) {
            produitsMap.set(produit.id, { 
              nom: produit.nom, 
              quantite: 0, 
              total: 0 
            });
          }
          
          const produitStats = produitsMap.get(produit.id);
          produitStats.quantite += produit.quantite;
          produitStats.total += produit.quantite * produit.prix;
        });
      });
      
      // Trier les produits par quantité vendue
      const produitsTriés = Array.from(produitsMap.values())
        .sort((a, b) => b.quantite - a.quantite)
        .slice(0, nombre);
      
      if (produitsTriés.length === 0) {
        await interaction.reply('Aucun produit vendu trouvé.');
        return;
      }
      
      const embed = new EmbedBuilder()
        .setColor('#4B6B31')
        .setTitle('Top Produits')
        .setDescription(`Les ${nombre} produits les plus vendus de la Ferme O'Neil`)
        .setTimestamp()
        .setFooter({ text: 'Ferme O\'Neil - Système de commandes' });
      
      produitsTriés.forEach((produit, index) => {
        embed.addFields({
          name: `#${index + 1} - ${produit.nom}`,
          value: `Quantité: ${produit.quantite} | Total: ${produit.total.toFixed(2)}$`
        });
      });
      
      await interaction.reply({ embeds: [embed] });
    }
  } catch (error) {
    console.error(`Erreur lors de l'exécution de la commande ${commandName}:`, error);
    await interaction.reply({ 
      content: 'Une erreur est survenue lors du traitement de votre commande.', 
      ephemeral: true 
    });
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