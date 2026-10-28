---
title: "Animations de chargement hors écran et faux suspect Swiper"
date: "2026-09-29"
module: "Images différées du thème Shopify"
problem_type: performance_issue
component: frontend
severity: high
symptoms:
  - "Environ 600 recalculs de style en dix secondes sur une page immobile"
  - "Temps CPU important attribué à Swiper dans le profil agrégé"
root_cause: logic_error
resolution_type: code_fix
tags: [shopify, lazy-image, css-animation, swiper, mobile-performance]
---

# Animations de chargement hors écran

## Problème

Sur la fiche lessive, dix images différées situées entre environ 7 200 et 11 750 pixels sous le haut de page conservaient une animation CSS de chargement active. Leurs téléchargements attendaient l'approche du viewport, mais leurs placeholders animaient continuellement la page.

Le profil agrégé mettait Swiper en évidence. Cela ne suffisait pas à prouver une boucle de redimensionnement : les compteurs des instances montraient seulement un ou deux événements de redimensionnement au chargement. Arrêter l'autoplay de l'annonce réduisait le JavaScript, sans supprimer les quelque 600 recalculs de style en dix secondes.

## Preuve discriminante

Dans le même onglet Chromium, après stabilisation, trois fenêtres successives de dix secondes ont donné :

| État | Recalculs de style | Durée des tâches |
| --- | ---: | ---: |
| Initial | 600 | 1,158 s |
| Animations `preloading` hors écran mises en pause | 1 | 0,131 s |
| Animations restaurées | 599 | 0,812 s |

Ce contre-test portait uniquement sur les animations hors écran, sans modification des scripts métier ni retrait des applications. Il établit leur contribution au travail de style en régime stable ; il ne mesure pas à lui seul un gain de LCP ou d'INP terrain.

Les données et le script sont conservés dans le dossier projet `outputs/2026-09-29_14-54-00Z-lighthouse-dev/swiper-diagnostic/`, notamment `result-offscreen-paused.json`. Ce dossier est un livrable local extérieur au dépôt Git.

## Solution en revue

Le correctif est destiné à la [PR de développement #2](https://github.com/OlivierBelaud/les-petits-bidons/pull/2), sans publication production à ce stade.

Dans `assets/theme.css`, les animations des médias en chargement sont en pause par défaut. La classe `loading-in-view` autorise leur animation quand le média entre dans le viewport. Dans `assets/vendor.js`, `LazyImage` crée un `IntersectionObserver` uniquement pour une image en attente, le déconnecte au chargement ou à l'erreur, et retire ses écouteurs lors de la déconnexion du composant. Les changements observés sont limités à `src`, `srcset` et `sizes`.

Les tests de `tests/lazy-image.test.mjs` couvrent notamment une image déjà chargée, l'erreur, la reconnexion et une notification d'intersection tardive après chargement. Le contrôle navigateur du correctif a observé zéro animation `preloading` active hors écran sur la fiche testée.

## Prévention

Avant de modifier Swiper à partir de son seul coût agrégé, compter ses événements et les animations réellement actives avec `document.getAnimations()`. Comparer leur travail dans le même onglet, puis restaurer le comportement initial pour contrôler la causalité. Vérifier aussi le bas de page : une image différée peut rester indéfiniment en attente sans que son placeholder doive consommer du CPU.
