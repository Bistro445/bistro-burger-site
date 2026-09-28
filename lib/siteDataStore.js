// Garde en mémoire les fichiers de données du site. Ils sont construits au
// démarrage puis reconstruits après chaque modification dans l'admin : plus
// besoin de redéployer pour qu'un changement de carte ou d'article apparaisse.
const { buildSiteFiles } = require("./siteData");

let files = null;
let running = null;
let lastError = null;
let lastBuildAt = null;

async function runBuild() {
  try {
    files = await buildSiteFiles(process.env);
    lastError = null;
    lastBuildAt = new Date().toISOString();
    return files;
  } catch (err) {
    lastError = err;
    console.error("[siteDataStore] " + err.message);
    throw err;
  }
}

// Reconstruit les fichiers. Si une reconstruction est déjà en cours, on attend
// qu'elle finisse puis on en lance une nouvelle, pour ne jamais renvoyer des
// données antérieures à la modification qui vient d'être enregistrée.
async function refresh() {
  if (running) await running.catch(() => {});
  running = runBuild().finally(() => { running = null; });
  return running;
}

// Renvoie les fichiers en mémoire ; s'il n'y en a pas encore, les construit.
async function getFiles() {
  if (files) return files;
  if (running) return running;
  return refresh();
}

module.exports = {
  refresh,
  getFiles,
  getLastError: () => lastError,
  getLastBuildAt: () => lastBuildAt,
};
