---
name: angular-translate
description: Extract static text in Angular templates and replace with ngx-translate keys; update public/i18n JSON files and use TranslatePipe/TranslateDirective in standalone components.
---

# Angular template translation with ngx-translate

## When to use
- Static text appears in .html templates.
- New UI strings need i18n support.
- Update or add translation keys in public/i18n/*.json.

## Project assumptions
- Angular standalone components (no NgModules).
- ngx-translate is configured via provideTranslateService with HTTP loader.
- Translation files live under public/i18n and are served at /i18n/.
- Default language is es-es.

## Workflow
1. Scan template for static text nodes and attribute values (e.g., button text, labels, placeholders).
2. Generate translation keys using dot notation by feature (e.g., products.form.nameLabel).
3. Add keys to public/i18n/es-es.json (and any other languages if present).
4. Replace template text with TranslatePipe or TranslateDirective.
5. Ensure the component imports TranslatePipe and/or TranslateDirective in its imports array.

## Replacement patterns
- Element text:
  - Before: <h1>Productos</h1>
  - After: <h1>{{ 'products.title' | translate }}</h1>
- Attribute text:
  - Before: <input placeholder="Nombre">
  - After: <input [placeholder]="'products.form.namePlaceholder' | translate">
- Button text:
  - Before: <button>Guardar</button>
  - After: <button>{{ 'common.save' | translate }}</button>

## Key naming rules
- Use lowercase with dots for feature grouping: feature.section.key
- Avoid spaces and special characters
- Prefer existing namespaces (common, auth, products) if present

## Guardrails
- Do not translate dynamic bindings (e.g., {{ user.name }}).
- Avoid changing logic or structure unless necessary.
- Keep minimal diffs and preserve formatting.
