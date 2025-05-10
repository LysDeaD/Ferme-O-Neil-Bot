// models/commande.js
const mongoose = require('mongoose');

// Schéma pour les produits dans une commande
const produitSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  nom: {
    type: String,
    required: true
  },
  quantite: {
    type: Number,
    required: true,
    min: 1
  },
  prix: {
    type: Number,
    required: true,
    min: 0
  }
});

// Schéma principal pour les commandes
const commandeSchema = new mongoose.Schema({
  discordId: {
    type: String,
    required: true
  },
  nom: {
    type: String,
    required: true
  },
  telephone: {
    type: String,
    required: true
  },
  produits: [produitSchema],
  total: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['En attente', 'Acceptée', 'En préparation', 'Terminée', 'En attente de livraison', 'Livrée'],
    default: 'En attente'
  },
  dateCommande: {
    type: Date,
    default: Date.now
  },
  commentaire: {
    type: String,
    default: ''
  },
  traitePar: {
    type: String,
    default: ''
  }
});

// Méthodes pour le suivi des commandes
commandeSchema.methods.updateStatus = function(nouveauStatus, traitePar = '') {
  this.status = nouveauStatus;
  if (traitePar) {
    this.traitePar = traitePar;
  }
  return this.save();
};

// Méthodes statiques pour les rapports
commandeSchema.statics.getCommandesParStatut = function(statut) {
  return this.find({ status: statut }).sort({ dateCommande: -1 });
};

commandeSchema.statics.getCommandesJour = function() {
  const dateDebut = new Date();
  dateDebut.setHours(0, 0, 0, 0);
  
  const dateFin = new Date();
  dateFin.setHours(23, 59, 59, 999);
  
  return this.find({
    dateCommande: {
      $gte: dateDebut,
      $lte: dateFin
    }
  }).sort({ dateCommande: -1 });
};

// Création du modèle
const Commande = mongoose.model('Commande', commandeSchema);

module.exports = Commande;