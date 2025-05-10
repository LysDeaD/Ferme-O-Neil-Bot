// routes/commandes.js
const express = require('express');
const router = express.Router();
const Commande = require('../models/commande');

// Fonction pour notifier le bot Discord (sera importée depuis le bot)
let notifierClient = null;
let notifierFermiers = null;

// Fonction pour initialiser les fonctions de notification
function initialiserNotifications(notifierClientFn, notifierFermiersFn) {
  notifierClient = notifierClientFn;
  notifierFermiers = notifierFermiersFn;
}

// Récupérer toutes les commandes (accès limité)
router.get('/', async (req, res) => {
  try {
    // Ajouter une auth ici plus tard pour protéger cette route
    const commandes = await Commande.find().sort({ dateCommande: -1 });
    res.json(commandes);
  } catch (error) {
    console.error('Erreur lors de la récupération des commandes:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Récupérer une commande par ID
router.get('/:id', async (req, res) => {
  try {
    const commande = await Commande.findById(req.params.id);
    if (!commande) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    }
    res.json(commande);
  } catch (error) {
    console.error('Erreur lors de la récupération de la commande:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer une nouvelle commande
router.post('/', async (req, res) => {
  try {
    const { discordId, nom, telephone, produits, total } = req.body;
    
    // Validation des données
    if (!discordId || !nom || !telephone || !produits || !total) {
      return res.status(400).json({ success: false, message: 'Données incomplètes' });
    }
    
    // Vérifier que les produits sont valides et au moins un produit est sélectionné
    if (!Array.isArray(produits) || produits.length === 0) {
      return res.status(400).json({ success: false, message: 'Au moins un produit doit être sélectionné' });
    }
    
    // Créer la commande
    const nouvelleCommande = new Commande({
      discordId,
      nom,
      telephone,
      produits,
      total
    });
    
    // Enregistrer la commande
    await nouvelleCommande.save();
    
    // Notifier le client et les fermiers si les fonctions sont disponibles
    let notificationClient = false;
    let notificationFermiers = false;
    
    if (notifierClient) {
      notificationClient = await notifierClient(nouvelleCommande);
    }
    
    if (notifierFermiers) {
      notificationFermiers = await notifierFermiers(nouvelleCommande);
    }
    
    res.status(201).json({
      success: true,
      message: 'Commande créée avec succès',
      commandeId: nouvelleCommande._id,
      notificationClient,
      notificationFermiers
    });
    
  } catch (error) {
    console.error('Erreur lors de la création de la commande:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de la commande' });
  }
});

// Mettre à jour le statut d'une commande
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, traitePar } = req.body;
    
    if (!status) {
      return res.status(400).json({ success: false, message: 'Statut manquant' });
    }
    
    const commande = await Commande.findById(req.params.id);
    if (!commande) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    }
    
    // Mettre à jour le statut
    await commande.updateStatus(status, traitePar);
    
    // Notifier le client du changement de statut
    let notificationEnvoyee = false;
    if (notifierClient) {
      notificationEnvoyee = await notifierClient(commande);
    }
    
    res.json({
      success: true,
      message: 'Statut mis à jour',
      notificationEnvoyee
    });
    
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Ajouter un commentaire à une commande
router.patch('/:id/commentaire', async (req, res) => {
  try {
    const { commentaire } = req.body;
    
    const commande = await Commande.findById(req.params.id);
    if (!commande) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    }
    
    commande.commentaire = commentaire;
    await commande.save();
    
    res.json({
      success: true,
      message: 'Commentaire ajouté'
    });
    
  } catch (error) {
    console.error('Erreur lors de l\'ajout du commentaire:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Exporter le router et la fonction d'initialisation
module.exports = {
  router,
  initialiserNotifications
};