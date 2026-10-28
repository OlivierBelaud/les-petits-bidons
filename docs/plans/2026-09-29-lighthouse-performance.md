# Optimisation mobile Lighthouse sur Dev

Mandat : corriger les performances insuffisantes du premier passage, déployer uniquement sur le thème 183837262202 et fournir une comparaison reproductible. Production et réglages globaux des applications exclus.

Référence : dev 71e300d ; livrable outputs/2026-09-29_14-54-00Z-lighthouse-dev à la racine projet. Lighthouse 13.5.0 mobile, réinitialisation native du stockage/cache Lighthouse, consentement accepté, même navigateur et configuration. Trois passages par route ; médianes et dispersion. Les métriques simulées Lighthouse ne sont pas directement comparables aux anciens chargements sous throttling CDP.

## Expériences ordonnées par les preuves

1. Mesurer produit et collection avant téléversement ; enregistrer environnement réellement chargé et rapports HTML/JSON.
2. Corriger la bannière collection : picture responsive, une seule ressource adaptée à l'écran, priorité hero, navigation AJAX conservée.
3. Attribuer les 16 secondes CPU Swiper observées : rechercher les boucles de layout/resize et vérifier le geste tactile ; corriger la cause prouvée.
4. Réduire les polices bloquantes et doublons en conservant les familles et caractères ; vérifier poids et rendu.
5. Retirer le vieux client Klaviyo seulement si absence de consommateurs confirmée ; conserver les formulaires modernes et le consentement.
6. Réduire les images secondaires de galerie chargées prématurément si l'audit confirme un coût initial ; navigation immédiate et changements de variante obligatoirement testés.
7. Examiner CSS bloquantes, scripts sous la ligne de flottaison et applications tierces ; ne conserver que les variantes avec bénéfice mesuré sans fonctionnalité supprimée.

## Validation et livraison

Pour chaque expérience, noter hypothèse, fichiers, mesure, décision conserver/rejeter. Déployer exclusivement vers l'ID Dev explicite. Confirmer trois passages pour le résultat retenu, mesurer CLS/TBT/LCP/poids/score, puis rejouer consentement, variante/quantité précoce, abonnement, panier, navigation mobile/desktop et passage au paiement sans commande. Simplification et revue avant livraison. Rapport avec gains, régressions, limites et actions applications éventuelles ; actualiser PR #2 sans fusion. Vérifier production inchangée et réconcilier les commits Shopify dans dev.

## État de l'implémentation et protocole affiné

Code candidat ea01517 : bannière responsive et remplacement AJAX du picture complet ; tailles des images de cartes ; polices locales et normalisation du nom de famille pour supprimer les doublons Shopify ; ancien client Klaviyo sans consommateur retiré ; CSS critiques d'annonce, en-tête, bannière et collection intégrées ; initialisation galerie à DOMContentLoaded ; images secondaires en templates inertes avec fallback sans JS ; préchargement responsive de l'image principale à priorité haute ; sources limitées autour de 2× sur petits écrans ; animation de placeholder limitée au viewport ; nettoyage des observers et écouteurs LazyImage.

Le profil incriminant Swiper était insuffisant pour attribuer la cause. Un contre-test pause/restauration des animations hors écran a ramené 600 recalculs de style en dix secondes à 1, puis 599 après restauration. Ce test ne constitue pas une mesure de LCP ou d'INP terrain.

Revue complète terminée, avec pair indépendant Claude. Deux lacunes d'intégration identifiées puis couvertes dans le navigateur : HTML serveur des slides et deux changements AJAX de collection. Touch swipe, boucle, changements de parfum et miniature desktop passent puis de nouveau sur le code final ; recette finale validée.

Les rapports Lighthouse peuvent conserver des ressources de preload marquées en cache malgré sa réinitialisation native. Ils sont présentés comme audits Lighthouse standards, jamais comme téléchargements tous froids. Une seconde série emploie explicitement CDP avec cache désactivé, CPU ×4, latence 150 ms, débit 200000 octets/s, écran 393×852 et DPR3. Une relance du navigateur a révélé une forte différence de TBT entre sessions : les valeurs de livraison doivent donc venir d'une nouvelle comparaison avant/après dans la même session, trois passages par route et protocole. Aucun chiffre ancien de TBT ne doit servir à annoncer artificiellement un gain.

Confirmation CDP terminée : LCP médian produit 13,632 → 1,908 s ; collection 14,700 → 1,976 s (un passage après à 4,812 s). Galerie disponible 0/3 → 3/3 sous réseau réellement bridé. DOMContentLoaded produit reste 12,798 s et chargement complet 27,047 s : le gain d'affichage ne vaut pas disponibilité complète en deux secondes.

Première confirmation Lighthouse : collection 7,759 → 3,377 s ; produit 3,782 → 4,007 s. Le moteur de décision refuse à ce stade le candidat (+5,94 % produit, seuil 5 %). Un indice CPU anormalement bas 1736 et la dispersion des mesures justifient une extension finie, définie avant exécution : deux paires supplémentaires alternées, médiane des cinq valeurs sans exclusion. Aucun changement de code entre ces passages. La décision de cette étape était suspendue aux deux paires supplémentaires ; leur résultat est consigné plus bas, avec conservation explicite du refus initial.

Correction de mesure issue de la revue documentaire : calculer le CLS CDP comme la fenêtre maximale de déplacements, pas leur somme. Les traces brutes suffisent à recalculer sans rejouer le navigateur. CLS observé standard de cette deuxième passe : produit 0,006809 → 0,010730 ; collection 0,008709 → 0,009425. Aucune amélioration de CLS revendiquée. Le chiffre historique collection 0,678404 → 0,010484 de la première passe a été recalculé et reste exact. Source de définition : https://web.dev/articles/cls .


La confirmation étendue de ea01517 conserve le candidat : produit Lighthouse 3931,739 → 3934,432 ms (inchangé), collection 7759,396 → 3377,429 ms. TBT en hausse, cibles 2500 ms non atteintes. Recette galerie/collection, erreurs réseau, achats, consentement et affichages validés ; contrôle fichiers Dev 489/489 identiques, production 473/473 inchangés.

Défaut d’abonnement supplémentaire reproduit pendant la recette : callbacks `load` de variantes inactives vidant le champ partagé. Correction minimale 6bc8101, masquage des fréquences conservé ; garde-fou d’achat synchronisait déjà le plan avant envoi. Test rouge puis 38 tests verts, reproduction navigateur avec 25 images retenues puis libérées corrigée. Une nouvelle série de trois passages par route/protocole rattache les chiffres de livraison à ce code final, sans mélanger les anciens essais candidat. La première série finale conservait le panier rempli après recette : elle reste diagnostique. La série `empty-final-*`, précédée d’un contrôle de panier vide, sert exclusivement au bilan final. Le compte panier de référence n’avait pas été enregistré explicitement ; ses captures ne montrent pas de badge.

## Bilan final du code 6bc8101

- Produit : LCP Lighthouse 3.932 → 3.628 s ; CDP réellement bridé 13.632 → 1.936 s.
- Collection : LCP Lighthouse 7.759 → 3.403 s ; CDP réellement bridé 14.700 → 1.960 s.

Décision conserver pour les deux LCP, objectifs Lighthouse 2,5 s non atteints ; TBT en hausse. 38 tests Node, recette achats/abonnement/galerie/AJAX/consentement et cinq routes aux deux formats validés. Aucun paiement. La fréquence d’abonnement reste celle affichée après changement de parfum. Theme Check 678 → 665, deux nouveaux avertissements AssetPreload documentés. Recette Safari/iPhone physique restante. Rapport final et preuves dans le dossier de livraison référencé en tête.
