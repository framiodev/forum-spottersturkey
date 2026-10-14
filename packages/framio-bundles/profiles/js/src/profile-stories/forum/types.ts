export interface StoryAttributes {
  id: number;
  userId: number;
  title: string;
  imgUrl: string;
  cta: string;
  username: string;
  contentIcon: string;
  contentText: string;
  contentCta: string;
  contentLink: string;
  createdAt: string;
  updatedAt: string;
}

export interface Story {
  type: 'stories';
  id: string;
  attributes: StoryAttributes;
}

export interface Links {
  first: string;
  next: string;
  prev?: string;
}

export interface Meta {
  total: number;
  totalPages: number;
}

export interface ApiStoryResponse {
  links: {
    first: string;
    next?: string;
    prev?: string;
  };
  data: {
    type: string;
    id: string;
    attributes: StoryAttributes;
  }[];
  meta: {
    total: number;
    totalPages: number;
  };
}
