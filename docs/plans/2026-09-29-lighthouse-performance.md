# Optimisation mobile Lighthouse sur Dev

Mandat : corriger les performances insuffisantes du premier passage, déployer uniquement sur le thème 183837262202 et fournir une comparaison reproductible. Production et réglages globaux des applications exclus.

Référence : dev 71e300d ; livrable outputs/2026-09-29_14-54-00Z-lighthouse-dev à la racine projet. Lighthouse 13.5.0 mobile, cache réseau vidé, consentement accepté, même navigateur et configuration. Trois passages par route ; médianes et dispersion. Les métriques simulées Lighthouse ne sont pas directement comparables aux anciens chargements sous throttling CDP.

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
