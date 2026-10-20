// Expo configures Metro for the monorepo itself (DECISIONS.md D3); this only adds .sql files,
// which hold the Drizzle migrations (D17).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');

module.exports = config;
