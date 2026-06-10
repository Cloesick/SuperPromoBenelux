# Apify base image with Node 20 + Puppeteer + Chromium preinstalled.
FROM apify/actor-node-puppeteer-chrome:20

# Install deps first (better layer caching). Use --omit=dev for a lean image.
COPY --chown=myuser:myuser package*.json ./
RUN npm install --omit=dev --no-audit --no-fund \
 && echo "installed:" && (npm ls --omit=dev --all || true)

# Copy the rest of the source.
COPY --chown=myuser:myuser . ./

CMD ["node", "src/main.js"]
