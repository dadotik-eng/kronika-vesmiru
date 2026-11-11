# Sestavení webu mimo GitHub Pages (beta náhledy na Cloudflare Pages).
# Stejná sada jako na GitHub Pages, aby beta vypadala přesně jako ostrý web.

# Server Cloudflare běží s ASCII locale – Sass by pak spadl na znacích UTF-8 ve výchozí šabloně.
Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

source "https://rubygems.org"
gem "github-pages", group: :jekyll_plugins
gem "webrick"
gem "faraday-retry"
