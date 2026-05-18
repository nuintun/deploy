/**
 * @module deploy.config
 */

import { defineConfig } from '@nuintun/deploy';

const ftpHost = process.env.FTP_HOST ?? '';
const ftpUser = process.env.FTP_USER ?? '';
const ftpPassword = process.env.FTP_PASSWORD ?? '';

export default defineConfig([
  {
    name: 'rpc.example.com',
    ftp: {
      port: 21,
      host: ftpHost,
      secure: false,
      user: ftpUser,
      timeout: 30000,
      password: ftpPassword,
      cleanBeforeDeploy: true,
      workspace: '/rpc.example.com'
    },
    svn: {
      cleanBeforeDeploy: true,
      commitMessage: 'deploy: update rpc.example.com',
      workspace: 'D:\\WORKSPACE\\SVN-REPO\\rpc.example.com'
    },
    entries: [
      {
        source: './pnpm-lock.yaml',
        target: 'pnpm-lock.yaml'
      },
      {
        source: './pnpm-workspace.yaml',
        target: 'pnpm-workspace.yaml'
      },
      {
        source: './packages/rpc/package.json',
        target: 'package.json'
      },
      {
        source: './packages/rpc/server/**/*',
        target: 'server/**/*'
      }
    ]
  },
  {
    name: 'web.example.com',
    ftp: {
      port: 21,
      host: ftpHost,
      secure: false,
      user: ftpUser,
      timeout: 30000,
      password: ftpPassword,
      cleanBeforeDeploy: true,
      workspace: '/web.example.com'
    },
    svn: {
      cleanBeforeDeploy: true,
      commitMessage: 'deploy: update web.example.com',
      workspace: 'D:\\WORKSPACE\\SVN-REPO\\web.example.com'
    },
    entries: [
      {
        source: './pnpm-lock.yaml',
        target: 'pnpm-lock.yaml'
      },
      {
        source: './pnpm-workspace.yaml',
        target: 'pnpm-workspace.yaml'
      },
      {
        source: './packages/web/package.json',
        target: 'package.json'
      },
      {
        source: './packages/web/wwwroot/**/*',
        target: 'wwwroot/**/*'
      }
    ]
  }
]);
