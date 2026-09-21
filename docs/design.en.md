# My bonsai — Game Design

**English** · [简体中文](design.zh-CN.md) · [README](../README.md)

This document describes the current game's core experience. Both language versions cover the same scope and should be updated together. The [original MVP proposal](一盆树-MVP设计文档.md) is retained as historical context; its participant system, daily pruning limit, and confirmation flow do not describe the current game. Detailed research and implementation notes remain in their original language.

## 1. The experience

My bonsai is a quiet, mobile-first browser game. A player adopts a distinctive sapling, watches it grow, and shapes it through small interactions. A permanent link makes it easy to return or invite someone to care for the same tree asynchronously.

There are no scores, win conditions, or scheduled chores. The tree is the focus: its silhouette, the spaces between branches, and changes that become visible over time.

## 2. Core loop

**Discover → adopt → watch → prune or water → leave → return.**

| Moment | Player action | Result |
| --- | --- | --- |
| Discover | Open the homepage and view a generated sapling. | A tree with its own appearance and pot is ready to adopt. |
| Adopt | Optionally enter a name and claim the tree. | The preview becomes a saved tree at `/t/:id`. |
| Return | Open the permanent link. | A short replay introduces its growth before showing the current state. |
| Shape | Drag the scissors to a side branch and release to prune. | The branch is removed; the trunk remains protected. Later growth responds to the remaining tree. |
| Care | Move the watering can near the pot. | Watering provides direct visual feedback and contributes to the tree's biological time. |
| Share | Use the share control or send the permanent link. | Another person can visit and interact with the same tree. |
| Explore | Open the courtyard gallery from the homepage. | Browse active trees and visit one by selecting it. |

Choosing simply to watch is a valid session. New growth takes time; pruning does not immediately replace the branch that was removed.

## 3. Trees and growth

- New trees use the versioned `bonsai-growth-3` model, with seven tree forms, compatible crown and leaf shapes, color palettes, and randomized pots. Rare palettes and eligible leaf shapes add variety.
- The adoption preview and the saved tree share the same generated design. Refreshing a saved tree does not reroll it.
- Growth is reconstructed from time, saved design, and interaction history. A continuously running background simulation is unnecessary.
- Pruning changes the living structure. Gradual regrowth preserves the tree's style and leaves room for the player's shaping decisions; natural branch limits prevent unlimited growth.
- Existing trees keep their saved model version and history when the default for new trees changes.

The growth schedule is an accelerated visual model, not a claim of botanical realism. Exact rules are maintained in the [v3 growth and pruning reference](v3剪枝与生长集成.md).

## 4. Interaction and presentation

The tree occupies the main scene. Scissors and the watering can behave as tools the player picks up and moves. Touch interactions are primary, with keyboard alternatives and accessible labels for the main tools. Feedback should make the target and result clear without filling the scene with instructions.

Flat colors, readable silhouettes, restrained controls, and space between foliage layers keep the tree legible on small screens. Time-of-day backgrounds and weather add atmosphere. Live weather requires configuration and location permission; the experience can still use device time without location.

Leaf trimming is currently a separate experiment at `/leaf-trim.html`, with browser-local results. It explores removing individual leaves and retaining a shaped crown outline. It should not be presented as an integrated, server-saved tool in the main game. See the [leaf-trimming design](修叶与树冠微整形设计.md).

## 5. Sharing and the courtyard

A tree has one persistent address. There are no accounts or owner permissions: anyone with the link can visit and interact. Naming a tree is not user authentication.

Sharing uses the system share sheet when available and copies an invitation and link otherwise. A prepared PNG may accompany the share; server-generated preview images let link previews show the saved tree without running JavaScript.

The courtyard is a visual gallery of recently active adopted trees. It loads in batches and renders nearby items to keep browsing responsive. Visits and successful interactions determine activity; loading gallery thumbnails does not count as visiting each tree.

## 6. Language

The homepage, tree detail page, and courtyard support English and Simplified Chinese. The initial language follows the first supported entry in the browser's language preferences, falling back to English. Chinese regional variants use Simplified Chinese.

The homepage language selector offers English, Chinese, and browser preference. A manual choice carries across the main pages. Tree names and search input remain unchanged. Client-side share invitations follow the interface language; server-generated sharing metadata retains its Chinese default. Developer sample pages are outside the current application localization scope.

This English design document and its [Chinese counterpart](design.zh-CN.md) are the paired entry points for product design. Update both when changing the core loop, feature status, or language behavior.

## 7. Implementation boundaries

| Area | Current approach |
| --- | --- |
| Client | Browser modules and SVG rendering in `prototype/`. |
| Server | `server.mjs` serves the app and APIs. |
| Storage | PostgreSQL in production; single-process JSON storage for local use. |
| Hosting configuration | Render serves the app; Neon supplies PostgreSQL through `DATABASE_URL`. |
| Model compatibility | Versioned engines under `prototype/core/` preserve older trees. |
| Validation | Repository tests and appropriate browser checks; local JSON tests do not verify live Neon or deployment. |

For local setup, CI, and deployment configuration, see the [README](../README.md). The [implementation reference](implementation-notes.zh-CN.md) retains detailed feature notes and links to research, including historical descriptions that may have been superseded.
