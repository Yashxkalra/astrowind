import type { PaginateFunction } from 'astro';
import type { Project } from '~/types';
import { APP_PROJECT } from 'astrowind:config';
import { getCollection, type CollectionEntry } from 'astro:content';
import {
  cleanSlug,
  trimSlash,
  PROJECT_PERMALINK_PATTERN,
  PROJECT_BASE,
  PROJECT_CATEGORY_BASE,
  PROJECT_TAG_BASE,
} from './permalinks';

/** */

const generatePermalink = async ({
  id,
  slug,
  publishDate,
  category,
}: {
  id: string;
  slug: string;
  publishDate: Date;
  category: string | undefined;
}) => {
  const year = String(publishDate.getFullYear()).padStart(4, '0');
  const month = String(publishDate.getMonth() + 1).padStart(2, '0');
  const day = String(publishDate.getDate()).padStart(2, '0');
  const hour = String(publishDate.getHours()).padStart(2, '0');
  const minute = String(publishDate.getMinutes()).padStart(2, '0');
  const second = String(publishDate.getSeconds()).padStart(2, '0');

  const permalink = PROJECT_PERMALINK_PATTERN.replace('%slug%', slug)
    .replace('%id%', id)
    .replace('%category%', category || '')
    .replace('%year%', year)
    .replace('%month%', month)
    .replace('%day%', day)
    .replace('%hour%', hour)
    .replace('%minute%', minute)
    .replace('%second%', second);

  return permalink
    .split('/')
    .map((el) => trimSlash(el))
    .filter((el) => !!el)
    .join('/');
};

const getNormalizedProject = async (projects: CollectionEntry<'projects'>): Promise<Project> => {
  const { id, slug: rawSlug = '', data } = projects;
  const { Content, remarkPluginFrontmatter } = await projects.render();

  const {
    publishDate: rawPublishDate = new Date(),
    updateDate: rawUpdateDate,
    title,
    excerpt,
    image,
    tags: rawTags = [],
    category: rawCategory,
    author,
    draft = false,
    metadata = {},
  } = data;

  const slug = cleanSlug(rawSlug); // cleanSlug(rawSlug.split('/').pop());
  const publishDate = new Date(rawPublishDate);
  const updateDate = rawUpdateDate ? new Date(rawUpdateDate) : undefined;

  const category = rawCategory
    ? {
        slug: cleanSlug(rawCategory),
        title: rawCategory,
      }
    : undefined;

  const tags = rawTags.map((tag: string) => ({
    slug: cleanSlug(tag),
    title: tag,
  }));

  return {
    id: id,
    slug: slug,
    permalink: await generatePermalink({ id, slug, publishDate, category: category?.slug }),

    publishDate: publishDate,
    updateDate: updateDate,

    title: title,
    excerpt: excerpt,
    image: image,

    category: category,
    tags: tags,
    author: author,

    draft: draft,

    metadata,

    Content: Content,
    // or 'content' in case you consume from API

    readingTime: remarkPluginFrontmatter?.readingTime,
  };
};

const load = async function (): Promise<Array<Project>> {
  const posts = await getCollection('projects');
  const normalizedPosts = posts.map(async (post) => await getNormalizedProject(post));

  const results = (await Promise.all(normalizedPosts))
    .sort((a, b) => b.publishDate.valueOf() - a.publishDate.valueOf())
    .filter((post) => !post.draft);

  return results;
};

let _projects: Array<Project>;

/** */
export const isProjectEnabled = APP_PROJECT.isEnabled;
export const isRelatedPostsEnabled = APP_PROJECT.isRelatedPostsEnabled;
export const isProjectListRouteEnabled = APP_PROJECT.list.isEnabled;
export const isProjectPostRouteEnabled = APP_PROJECT.post.isEnabled;
export const isProjectCategoryRouteEnabled = APP_PROJECT.category.isEnabled;
export const isProjectTagRouteEnabled = APP_PROJECT.tag.isEnabled;

export const ProjectListRobots = APP_PROJECT.list.robots;
export const ProjectPostRobots = APP_PROJECT.post.robots;
export const ProjectCategoryRobots = APP_PROJECT.category.robots;
export const ProjectTagRobots = APP_PROJECT.tag.robots;

export const ProjectPostsPerPage = APP_PROJECT?.postsPerPage;

/** */
export const fetchProjects = async (): Promise<Array<Project>> => {
  if (!_projects) {
    _projects = await load();
  }

  return _projects;
};

/** */
export const findProjectsBySlugs = async (slugs: Array<string>): Promise<Array<Project>> => {
  if (!Array.isArray(slugs)) return [];

  const posts = await fetchProjects();

  return slugs.reduce(function (r: Array<Project>, slug: string) {
    posts.some(function (post: Project) {
      return slug === post.slug && r.push(post);
    });
    return r;
  }, []);
};

/** */
export const findProjectsByIds = async (ids: Array<string>): Promise<Array<Project>> => {
  if (!Array.isArray(ids)) return [];

  const posts = await fetchProjects();

  return ids.reduce(function (r: Array<Project>, id: string) {
    posts.some(function (post: Project) {
      return id === post.id && r.push(post);
    });
    return r;
  }, []);
};

/** */
export const findLatestPosts = async ({ count }: { count?: number }): Promise<Array<Project>> => {
  const _count = count || 4;
  const posts = await fetchProjects();

  return posts ? posts.slice(0, _count) : [];
};

/** */
export const getStaticPathsProjectList = async ({ paginate }: { paginate: PaginateFunction }) => {
  if (!isProjectEnabled || !isProjectListRouteEnabled) return [];
  return paginate(await fetchProjects(), {
    params: { projects: PROJECT_BASE || undefined },
    pageSize: ProjectPostsPerPage,
  });
};

/** */
export const getStaticPathsProjectPost = async () => {
  if (!isProjectEnabled || !isProjectPostRouteEnabled) return [];
  return (await fetchProjects()).flatMap((post) => ({
    params: {
      projects: post.permalink,
    },
    props: { post },
  }));
};

/** */
export const getStaticPathsProjectCategory = async ({ paginate }: { paginate: PaginateFunction }) => {
  if (!isProjectEnabled || !isProjectCategoryRouteEnabled) return [];

  const posts = await fetchProjects();
  const categories = {};
  posts.map((post) => {
    post.category?.slug && (categories[post.category?.slug] = post.category);
  });

  return Array.from(Object.keys(categories)).flatMap((categorySlug) =>
    paginate(
      posts.filter((post) => post.category?.slug && categorySlug === post.category?.slug),
      {
        params: { category: categorySlug, projects: PROJECT_CATEGORY_BASE || undefined },
        pageSize: ProjectPostsPerPage,
        props: { category: categories[categorySlug] },
      }
    )
  );
};

/** */
export const getStaticPathsProjectTag = async ({ paginate }: { paginate: PaginateFunction }) => {
  if (!isProjectEnabled || !isProjectTagRouteEnabled) return [];

  const posts = await fetchProjects();
  const tags = {};
  posts.map((post) => {
    Array.isArray(post.tags) &&
      post.tags.map((tag) => {
        tags[tag?.slug] = tag;
      });
  });

  return Array.from(Object.keys(tags)).flatMap((tagSlug) =>
    paginate(
      posts.filter((post) => Array.isArray(post.tags) && post.tags.find((elem) => elem.slug === tagSlug)),
      {
        params: { tag: tagSlug, projects: PROJECT_TAG_BASE || undefined },
        pageSize: ProjectPostsPerPage,
        props: { tag: tags[tagSlug] },
      }
    )
  );
};

/** */
export async function getRelatedProjects(originalPost: Project, maxResults: number = 4): Promise<Project[]> {
  const allPosts = await fetchProjects();
  const originalTagsSet = new Set(originalPost.tags ? originalPost.tags.map((tag) => tag.slug) : []);

  const postsWithScores = allPosts.reduce((acc: { post: Project; score: number }[], iteratedPost: Project) => {
    if (iteratedPost.slug === originalPost.slug) return acc;

    let score = 0;
    if (iteratedPost.category && originalPost.category && iteratedPost.category.slug === originalPost.category.slug) {
      score += 5;
    }

    if (iteratedPost.tags) {
      iteratedPost.tags.forEach((tag) => {
        if (originalTagsSet.has(tag.slug)) {
          score += 1;
        }
      });
    }

    acc.push({ post: iteratedPost, score });
    return acc;
  }, []);

  postsWithScores.sort((a, b) => b.score - a.score);

  const selectedPosts: Project[] = [];
  let i = 0;
  while (selectedPosts.length < maxResults && i < postsWithScores.length) {
    selectedPosts.push(postsWithScores[i].post);
    i++;
  }

  return selectedPosts;
}
