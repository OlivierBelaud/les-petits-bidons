# Raccordement Cookiebot à Shopify

Base : 84b7ec5. Travail et déploiement uniquement sur dev / thème 183837262202.

## Diagnostic confirmé

Le refus Cookiebot laisse currentVisitorConsent vide et marketingAllowed vrai ; après rechargement _fbp et _pin_unauth reviennent. Cookiebot est chargé dans layout/theme.liquid sans pont ; les appels existants de cookie-banner.js appartiennent à une autre bannière.

## Mise en œuvre

1. Installer un snippet avant Cookiebot pour enregistrer les écouteurs avant ses événements. Exclure ce script de son blocage automatique.
2. Transmettre statistics → analytics, marketing → marketing, preferences → preferences uniquement lorsqu'une réponse Cookiebot existe. Ne pas inventer de refus à la première visite. Ne pas écrire sale_of_data.
3. Charger consent-tracking-api via loadFeatures si nécessaire, attente bornée. Relire l'état courant, sérialiser les écritures et éviter les doublons. Restaurer un choix existant si Shopify ne le connaît pas ; gérer refus, choix partiels et retrait.
4. Tests Node avec API simulée pour les catégories, courses de chargement, doublons, erreurs et changements pendant écriture. Revue et simplification avant déploiement.
5. Déployer uniquement le snippet et son inclusion sur la preview. Tests navigateur : visite vierge, boutons accepter/refuser, trois choix partiels, retrait, rechargement, navigation vers produit/panier. Vérifier thème, consentements enregistrés, permissions et noms de cookies sans conserver leurs valeurs.

## Critères et limites

Le refus est enregistré par Shopify et les cookies Meta/Pinterest ne reviennent pas après rechargement. Les choix partiels correspondent exactement aux catégories. Les états acceptés persistent et le retrait coupe les permissions. Vérifier les requêtes réseau lorsque possible.

Les réglages régionaux partagés doivent être contrôlés séparément : la première visite ne doit pas être présentée comme corrigée si Shopify reste permissif. Ne modifier ni main, ni le thème live, ni les réglages globaux dans ce mandat dev. Checkout et conversions serveur hors périmètre.

Sources : https://shopify.dev/docs/api/customer-privacy ; https://www.cookiebot.com/us/developer/ ; https://support.cookiebot.com/hc/en-us/articles/360006184253-Shopify-installation . Le raccourci marketing → sale_of_data de l'exemple Cookiebot n'est volontairement pas repris.
