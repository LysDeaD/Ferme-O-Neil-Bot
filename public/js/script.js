// script.js - Script pour le site web O'Neil Farm
document.addEventListener('DOMContentLoaded', function() {
  // Référence aux éléments du formulaire
  const formulaire = document.getElementById('formulaire-commande');
  const btnCommander = document.getElementById('btn-commander');
  const messageResultat = document.getElementById('message-resultat');

  // Ajouter un formulaire si ce n'est pas déjà fait dans le HTML
  if (!formulaire) {
    const mainElement = document.querySelector('main');
    const divTotal = document.querySelector('div[style*="text-align: center"]');
    
    // Créer un nouveau formulaire
    const nouveauFormulaire = document.createElement('form');
    nouveauFormulaire.id = 'formulaire-commande';
    
    // Ajouter les inputs existants au formulaire
    const infosDiv = document.getElementById('infos');
    if (infosDiv) {
      nouveauFormulaire.appendChild(infosDiv.cloneNode(true));
      infosDiv.parentNode.removeChild(infosDiv);
    }
    
    // Ajouter le bouton de commande
    const boutonCommander = document.createElement('button');
    boutonCommander.id = 'btn-commander';
    boutonCommander.type = 'button';
    boutonCommander.textContent = 'Passer la commande';
    boutonCommander.className = 'btn-commande';
    nouveauFormulaire.appendChild(boutonCommander);
    
    // Ajouter un élément pour afficher les messages
    const divMessage = document.createElement('div');
    divMessage.id = 'message-resultat';
    divMessage.style.margin = '10px 0';
    nouveauFormulaire.appendChild(divMessage);
    
    // Insérer le formulaire dans la page
    if (divTotal) {
      divTotal.appendChild(nouveauFormulaire);
    } else {
      mainElement.appendChild(nouveauFormulaire);
    }
  }

  // Récupérer le bouton après création si nécessaire
  const boutonCommander = document.getElementById('btn-commander');
  
  if (boutonCommander) {
    boutonCommander.addEventListener('click', function() {
      envoyerCommande();
    });
  }

  // Fonction pour envoyer la commande
  function envoyerCommande() {
    // Récupérer les valeurs du formulaire
    const discordId = document.getElementById('discord').value;
    const nom = document.getElementById('nom').value;
    const telephone = document.getElementById('tel').value;
    const messageResultat = document.getElementById('message-resultat');

    // Validation des champs
    if (!discordId || !nom || !telephone) {
      afficherMessage('Veuillez remplir tous les champs obligatoires', 'erreur');
      return;
    }

    // Format Discord ID (vérification basique)
    if (!discordId.match(/^\d{17,19}$/)) {
      afficherMessage('Le format de l\'ID Discord n\'est pas valide (exemple: 123456789012345678)', 'erreur');
      return;
    }

    // Récupérer les produits sélectionnés
    const produits = [];
    const produitsIds = ["salade", "tomate", "oignon", "carotte", "fraise", "lait", "courge", "ble", "banane", "agave", "pdt", "oeuf", "fertilisant","poivron","champignon"];
    let totalCommande = 0;

    produitsIds.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        const quantite = parseInt(input.value) || 0;
        const prix = parseFloat(input.dataset.prix) || 0;
        
        if (quantite > 0) {
          produits.push({
            id: id,
            nom: id.charAt(0).toUpperCase() + id.slice(1), // Première lettre en majuscule
            quantite: quantite,
            prix: prix
          });
          totalCommande += quantite * prix;
        }
      }
    });

    // Vérifier qu'au moins un produit est sélectionné
    if (produits.length === 0) {
      afficherMessage('Veuillez sélectionner au moins un produit', 'erreur');
      return;
    }

    // Créer l'objet de commande
    const commande = {
      discordId: discordId,
      nom: nom,
      telephone: telephone,
      produits: produits,
      total: totalCommande
    };

    // Afficher message d'envoi
    afficherMessage('Envoi de votre commande en cours...', 'info');

    // Envoyer la commande au serveur backend
    fetch('/api/commandes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commande)
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        afficherMessage('Commande envoyée avec succès! Vous allez recevoir un message privé sur Discord.', 'succes');
        
        // Réinitialiser le formulaire
        document.getElementById('discord').value = '';
        document.getElementById('nom').value = '';
        document.getElementById('tel').value = '';
        
        // Réinitialiser les quantités
        produitsIds.forEach(id => {
          const input = document.getElementById(id);
          if (input) {
            input.value = 0;
          }
        });
        
        // Recalculer le total
        calculerTotal();
      } else {
        afficherMessage('Erreur: ' + data.message, 'erreur');
      }
    })
    .catch(error => {
      console.error('Erreur:', error);
      afficherMessage('Une erreur s\'est produite lors de l\'envoi de la commande. Veuillez réessayer.', 'erreur');
    });
  }

  function afficherMessage(message, type) {
    const messageElement = document.getElementById('message-resultat');
    if (messageElement) {
      messageElement.textContent = message;
      
      // Supprimer les classes précédentes
      messageElement.className = '';
      
      // Ajouter la classe correspondant au type de message
      switch (type) {
        case 'succes':
          messageElement.classList.add('message-succes');
          break;
        case 'erreur':
          messageElement.classList.add('message-erreur');
          break;
        case 'info':
          messageElement.classList.add('message-info');
          break;
      }
    }
  }
});