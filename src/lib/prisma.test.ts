import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { prisma } from './prisma';

describe('Prisma Integration Tests', () => {
  const testEmail = `test-${Date.now()}@integration.com`;

  beforeAll(async () => {
    // Clean up any possibility of the user existing prior
    await prisma.post.deleteMany({
      where: { author: { email: testEmail } },
    });
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
  });

  afterAll(async () => {
    // Clean up our test user and any related objects
    await prisma.post.deleteMany({
      where: { author: { email: testEmail } },
    });
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });

    // Disconnect client explicitly after tests complete to avoid open handlers
    await prisma.$disconnect();
  });

  it('should be able to establish a connection using queryRaw', async () => {
    // A simple test to confirm the database resolves our query
    const result = await prisma.$queryRaw`SELECT 1 as success;`;
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect((result as any[])[0].success.toString()).toBe('1');
  });

  it('should create a new user in the database', async () => {
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: 'Integration Test User',
      },
    });

    expect(user).toBeDefined();
    expect(user.id).toBeGreaterThan(0);
    expect(user.email).toBe(testEmail);
    expect(user.name).toBe('Integration Test User');
  });

  it('should fetch the created user from the database', async () => {
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
    });

    expect(user).toBeDefined();
    expect(user?.email).toBe(testEmail);
    expect(user?.name).toBe('Integration Test User');
  });

  it('should successfully update the user record', async () => {
    const updatedUser = await prisma.user.update({
      where: { email: testEmail },
      data: { name: 'Updated Test User' },
    });

    expect(updatedUser.name).toBe('Updated Test User');
  });

  it('should create a related Post for the user', async () => {
    const post = await prisma.post.create({
      data: {
        title: 'Integration Test Title',
        content: 'Integration test content',
        published: true,
        author: {
          connect: { email: testEmail },
        },
      },
    });

    expect(post).toBeDefined();
    expect(post.title).toBe('Integration Test Title');
    expect(post.authorId).toBeDefined();
  });

  it('should fetch the user with their posts included', async () => {
    const userWithPosts = await prisma.user.findUnique({
      where: { email: testEmail },
      include: { posts: true },
    });

    expect(userWithPosts).toBeDefined();
    expect(userWithPosts?.posts).toBeDefined();
    expect(Array.isArray(userWithPosts?.posts)).toBe(true);
    expect(userWithPosts?.posts.length).toBe(1);
    expect(userWithPosts?.posts[0].title).toBe('Integration Test Title');
  });

  it('should delete the user and their posts successfully', async () => {
    // Prisma usually requires you to delete related records first unless Cascade rules are set
    const deletePostsResult = await prisma.post.deleteMany({
      where: { author: { email: testEmail } },
    });
    expect(deletePostsResult.count).toBe(1);

    const deletedUser = await prisma.user.delete({
      where: { email: testEmail },
    });

    expect(deletedUser).toBeDefined();
    expect(deletedUser.email).toBe(testEmail);

    // Verify they are completely removed
    const checkUser = await prisma.user.findUnique({
      where: { email: testEmail },
    });
    expect(checkUser).toBeNull();
  });
});
