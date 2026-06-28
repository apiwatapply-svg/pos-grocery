import { hashPassword } from "../auth/auth.service.js";
import { defaultUserRepository, type UserRepository } from "./user.repository.js";

export async function seedInitialAdmin(deps: {
  adminUsername: string;
  adminPassword: string;
  storeName: string;
  repository?: UserRepository;
}): Promise<void> {
  const repository = deps.repository ?? defaultUserRepository;
  let store = await repository.getFirstStore();

  if (!store) {
    store = await repository.createStore({
      name: deps.storeName,
      phone: "-",
      address: "-",
      ownerName: deps.adminUsername,
      status: "active",
    });
  }

  const existingUser = await repository.findUserByUsername(deps.adminUsername);

  if (existingUser) {
    return;
  }

  await repository.createUser({
    storeId: store.id,
    username: deps.adminUsername,
    passwordHash: await hashPassword(deps.adminPassword),
    displayName: deps.adminUsername,
    role: "owner",
    status: "active",
  });
}
