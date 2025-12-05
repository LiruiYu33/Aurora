const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { resolve } = require('metro-resolver');

const config = getDefaultConfig(__dirname);
const defaultResolveRequest = config.resolver.resolveRequest;

// Support path aliases like "@/components" used throughout the app
config.resolver.resolveRequest = (context, moduleName, platform) => {
	if (moduleName.startsWith('@/')) {
		const normalized = path.join(__dirname, moduleName.replace('@/', ''));
		return resolve(context, normalized, platform);
	}
	return defaultResolveRequest
		? defaultResolveRequest(context, moduleName, platform)
		: resolve(context, moduleName, platform);
};

module.exports = config;
