const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Model files of the on-device encoder (assets/models/edge_encoder_v1): ONNX and the raw float32 byte table.
config.resolver.assetExts.push('onnx', 'f32');

module.exports = config;
