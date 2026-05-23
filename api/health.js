'use strict';

module.exports = function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    version: '2.0.0',
    runtime: 'vercel-serverless',
    timestamp: new Date().toISOString(),
  });
};
