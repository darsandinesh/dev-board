# Custom Keycloak login theme (`devboard`)

This is how DevBoard's branded Keycloak login page is wired. A Keycloak *theme*
is just a folder of templates + static assets; you can brand the login screen
with CSS/images alone (no FreeMarker template changes), which is what we do here.

## Layout

```
infra/keycloak/themes/devboard/
└── login/
    ├── theme.properties          # declares parent theme + which stylesheets to load
    └── resources/
        ├── css/devboard.css      # our branding (gradient bg, card, buttons, logo)
        └── img/logo.svg          # the DevBoard logo shown above the card
```

`theme.properties`:
```properties
parent=keycloak                   # inherit the stock keycloak login theme...
import=common/keycloak
styles=css/login.css css/devboard.css   # ...then layer our CSS on top
```

`css/login.css` resolves from the parent theme (resource lookup walks parents);
`css/devboard.css` is ours and loads last, so it overrides. Images in the theme
are served at `/resources/<build-hash>/login/devboard/img/...`, and CSS can
reference them relatively (`url("../img/logo.svg")`).

## How it's activated (3 steps)

### 1. Make the theme available to the container
The theme folder is mounted **alongside** the built-in themes (not over them, or
`parent=keycloak` would break) — see `docker-compose.yml`:
```yaml
keycloak:
  volumes:
    - ./infra/keycloak/themes/devboard:/opt/keycloak/themes/devboard
```

### 2. Tell the realm to use it
Set the realm's **Login theme** to `devboard`. Two ways:

- **Baked into the realm import** (fresh setups) — `realm-export.json`:
  ```json
  { "realm": "devboard", "loginTheme": "devboard", "displayName": "DevBoard" }
  ```
- **On a running server** via the Admin REST API (or Admin Console →
  Realm settings → Themes → Login theme):
  ```bash
  KC=http://localhost:8080
  ADM=$(curl -s -X POST "$KC/realms/master/protocol/openid-connect/token" \
        -d grant_type=password -d client_id=admin-cli \
        -d username=admin -d password=admin | jq -r .access_token)
  curl -X PUT "$KC/admin/realms/devboard" \
    -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' \
    -d '{"realm":"devboard","loginTheme":"devboard","displayName":"DevBoard"}'
  ```

### 3. Pick up changes
- We run Keycloak with `start-dev`, which **disables theme caching**, so CSS edits
  show on the next page load.
- **Adding new resource files** (like `logo.svg`) requires a restart, because the
  resource path hash is computed at startup:
  ```bash
  docker compose restart keycloak
  ```
- In production (`start`), set `--spi-theme-cache-themes=false` while iterating,
  then re-enable for performance.

## Verify
```bash
# the authorize page should reference the devboard theme assets (HTTP 200)
curl -s 'http://localhost:8080/realms/devboard/protocol/openid-connect/auth?client_id=devboard-app&response_type=code&scope=openid&redirect_uri=http://localhost:3001' \
  | grep -oE '/resources/[^"]*(devboard\.css|logo\.svg)'
```
Then open the app and click **Sign in** — you'll land on the branded page.

## Customizing further
- **Colors / layout** → edit `resources/css/devboard.css` (reload the page).
- **Logo** → replace `resources/img/logo.svg`, then `docker compose restart keycloak`.
- **Text** (titles, labels) → add `messages/messages_en.properties` overriding keys
  like `loginTitleHtml`, `usernameOrEmail`, etc.
- **Markup** (full control) → copy a template such as `login.ftl` from the base
  theme into `login/` and edit it. Only do this when CSS isn't enough — template
  overrides can break on Keycloak upgrades.
- The same pattern themes other flows: add `account/`, `email/`, or `admin/`
  subfolders next to `login/`.
