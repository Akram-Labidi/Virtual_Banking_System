# AuraBank — Virtual Banking System

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js 20+" />
  <img src="https://img.shields.io/badge/NestJS-10-ED2945?logo=nestjs&logoColor=white" alt="NestJS 10" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
</p>

Application bancaire de démonstration conçue pour simuler un système de banque moderne avec moteur transactionnel, grand livre comptable, contrôle de concurrence, sécurité RBAC et interface utilisateur professionnelle.

> **Avertissement :** ce projet est destiné à l’apprentissage, aux démonstrations et au portfolio. Il ne s’agit pas d’un système bancaire réel et ne doit pas être utilisé pour traiter de vrais fonds, paiements ou données sensibles sans revue de sécurité, audits réglementaires, gestion des secrets et migrations de production.

## Pourquoi ce projet ?

AuraBank a été conçu pour illustrer une architecture bancaire robuste et crédible, avec :

- un backend API sécurisé en NestJS,
- une logique comptable en partie double,
- des mécanismes de concurrence et d’idempotence,
- une séparation des rôles utilisateurs,
- une interface de gestion orientée produit,
- une base technologique adaptée à une démonstration de compétences techniques.

---

## Fonctionnalités principales

- Inscription client et authentification JWT avec rafraîchissement de tokens
- Gestion des rôles : client, conseiller et administrateur
- Ouverture de comptes courant et épargne
- Dépôts, retraits, virements internes et vérification de soldes
- Grand livre comptable en double entrée avec validation des écritures
- Vérrouillage de comptes et traitement transactionnel sécurisé
- Clés d’idempotence pour empêcher les doubles traitements
- Alertes de fraude et journaux d’audit avec empreinte SHA-256
- Cartes virtuelles simulées avec plafonds et règles métier
- Simulation de demandes de prêt et approbation par le personnel
- Simulateur de trafic réservé aux profils autorisés
- Documentation Swagger API et interface utilisateur protégée par rôle

---

## Architecture

```text
React + Vite (5173)
        │ /api (proxy Vite)
        ▼
NestJS (3000) ── auth, accounts, transactions, ledger,
        │          fraud, cards, loans, audit, simulator
        ▼
PostgreSQL (5432) via TypeORM
```

Le grand livre enregistre chaque opération dans une transaction de base de données. Les comptes concernés sont verrouillés dans un ordre déterministe pour éviter les incohérences. Une même clé d’idempotence rejoue exactement le même résultat, et toute réutilisation sur un autre mouvement est refusée.

---

## Stack technique

### Backend
- NestJS
- TypeScript
- TypeORM
- PostgreSQL
- JWT / Passport
- Swagger
- Class-validator / Class-transformer

### Frontend
- React
- Vite
- TypeScript
- Tailwind CSS

---

## Prérequis

- Node.js 20 ou plus récent
- npm
- Docker Desktop
- Git

---

## Démarrage rapide (Windows / PowerShell)

### 1) Démarrer PostgreSQL

```powershell
cd "C:\Users\MSI\Desktop\Files\projects Git\Virtual Banking System"
docker compose up -d postgres
```

### 2) Créer le fichier d’environnement backend

```powershell
Copy-Item backend\.env.example backend\.env
```

Ensuite, définissez des valeurs fortes et distinctes pour :

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

Exemple pour générer une clé locale :

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

### 3) Lancer le backend

```powershell
cd "C:\Users\MSI\Desktop\Files\projects Git\Virtual Banking System\backend"
npm install
npm run start:dev
```

### 4) Lancer le frontend

```powershell
cd "C:\Users\MSI\Desktop\Files\projects Git\Virtual Banking System\frontend"
npm install
npm run dev
```

### 5) Ouvrir l’application

- Frontend : <http://localhost:5173>
- Swagger API : <http://localhost:3000/api/docs>

---

## Comptes de démonstration

Le schéma se synchronise automatiquement en développement. Pour charger les utilisateurs de démonstration, configurez `SEED_DEMO_DATA=true` avant le premier démarrage backend.

Identifiants de démonstration :

- `alice@aurabank.fr`
- `bob@aurabank.fr`
- `conseiller@aurabank.fr`
- `admin@aurabank.fr`

Mot de passe commun :

```text
BankSecret2026!
```

> **Important :** désactivez cette option et changez ou supprimez ces comptes avant tout déploiement réel.

Sans données de démonstration, vous pouvez créer un compte depuis la page d’inscription. Les inscriptions publiques ne peuvent créer que des clients.

---

## Commandes utiles

Depuis la racine du projet :

| Commande | Description |
|---|---|
| `npm run dev:backend` | Démarre le backend NestJS en mode watch |
| `npm run dev:frontend` | Démarre le frontend Vite |
| `npm run build` | Construit les applications backend et frontend |
| `npm test` | Exécute les tests backend |
| `npm run test:concurrency` | Lance le test de concurrence du moteur transactionnel |

---

## Configuration et limites connues

- `DB_TYPE=postgres` est le mode recommandé pour une utilisation réaliste.
- SQLite peut convenir à un usage local simple, mais il ne fournit pas les mêmes garanties de verrouillage de lignes.
- `SEED_DEMO_DATA` est désactivé par défaut.
- En production, `synchronize` est désactivé ; des migrations TypeORM doivent être ajoutées et exécutées avant le déploiement.
- Les cartes et opérations liées à la simulation de cartes sont purement démonstratives.
- Le healthcheck de l’API et de PostgreSQL est exposé sur `/api/health`.

---

## Sécurité et bonnes pratiques

Ce projet est un exemple pédagogique et ne remplace pas une revue de sécurité professionnelle. Avant toute mise en production, il est conseillé de vérifier :

- la rotation des secrets JWT,
- la configuration des variables d’environnement,
- les politiques de permissions RBAC,
- les mécanismes de logging et d’audit,
- les migrations et la stratégie de backup de données,
- la conformité réglementaire selon le contexte d’utilisation.

---

## Contribution

Les contributions sont les bienvenues. Pour proposer une amélioration :

1. fork du projet,
2. création d’une branche dédiée,
3. implémentation des changements,
4. validation locale via tests et build,
5. ouverture d’une pull request détaillée.

---

## Licence

Ce projet est fourni à des fins pédagogiques et de démonstration. Vérifiez les conditions d’usage avant toute réutilisation commerciale ou institutionnelle.

---

## Remerciements

Conçu pour mettre en valeur une architecture bancaire moderne, pensée autour de la robustesse transactionnelle, de la sécurité et du bon sens métier.
