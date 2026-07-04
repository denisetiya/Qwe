export interface Post {
  id: number;
  title: string;
  content: string;
  userId: number;
  createdAt: string;
}

export interface CreatePostInput {
  title: string;
  content: string;
  userId: number;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
}

let nextId = 1;

export class PostsService {
  private posts: Post[] = [];

  findAll(): { data: Post[]; total: number } {
    return { data: this.posts, total: this.posts.length };
  }

  findById(id: number): Post | undefined {
    return this.posts.find((p) => p.id === id);
  }

  findByUserId(userId: number): Post[] {
    return this.posts.filter((p) => p.userId === userId);
  }

  create(input: CreatePostInput): Post {
    const post: Post = {
      id: nextId++,
      title: input.title,
      content: input.content,
      userId: input.userId,
      createdAt: new Date().toISOString(),
    };
    this.posts.push(post);
    return post;
  }

  update(id: number, input: UpdatePostInput): Post | undefined {
    const post = this.findById(id);
    if (!post) return undefined;
    if (input.title !== undefined) post.title = input.title;
    if (input.content !== undefined) post.content = input.content;
    return post;
  }

  delete(id: number): boolean {
    const idx = this.posts.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.posts.splice(idx, 1);
    return true;
  }
}
