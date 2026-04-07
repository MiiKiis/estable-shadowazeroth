import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://shadowazeroth.com';
  const now = new Date();

  const routes = [
    '/',
    '/news',
    '/donate',
    '/addons',
    '/forum',
    '/armory',
    '/armory/marketplace',
    '/staff',
    '/disclaimer',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === '/' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : 0.7,
  }));
}
