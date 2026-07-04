export interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  createdAt: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  age: number;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  age?: number;
}

let nextId = 1;

export class UsersService {
  private users: User[] = [];

  findAll(): { data: User[]; total: number } {
    return { data: this.users, total: this.users.length };
  }

  findById(id: number): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  create(input: CreateUserInput): User {
    const user: User = {
      id: nextId++,
      name: input.name,
      email: input.email,
      age: input.age,
      createdAt: new Date().toISOString(),
    };
    this.users.push(user);
    return user;
  }

  update(id: number, input: UpdateUserInput): User | undefined {
    const user = this.findById(id);
    if (!user) return undefined;
    if (input.name !== undefined) user.name = input.name;
    if (input.email !== undefined) user.email = input.email;
    if (input.age !== undefined) user.age = input.age;
    return user;
  }

  delete(id: number): boolean {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    this.users.splice(idx, 1);
    return true;
  }
}
