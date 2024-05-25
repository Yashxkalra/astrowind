import { getRssString } from '@astrojs/rss';
import { SITE, METADATA, APP_PROJECT } from 'astrowind:config';
import { fetchProjects } from '~/utils/getProjectData'; // Adjust this import as needed
import { getPermalink } from '~/utils/permalinks';

export const GET = async () => {
  if (!APP_PROJECT.isEnabled) {
    return new Response(null, {
      status: 404,
      statusText: 'Not found',
    });
  }

  const projects = await fetchProjects();

  const rss = await getRssString({
    title: `${SITE.name}’s Projects`,
    description: METADATA?.description || '',
    site: import.meta.env.SITE,

    items: projects.map((project) => ({
      link: getPermalink(project.permalink, 'project_post'),
      title: project.title,
      description: project.excerpt,
      pubDate: project.publishDate,
    })),

    trailingSlash: SITE.trailingSlash,
  });

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
};
