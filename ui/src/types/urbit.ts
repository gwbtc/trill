export type Ship = string;
export interface S3Bucket {
  accessKeyId: string;
  endpoint: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
}
export type S3Config = StorageCredentials & StorageConfiguration;
export type UrbitContacts = Record<Ship, Contact | null>;

export interface Contact {
  avatar: string | null;
  cover: string | null;
  bio: string;
  color: string; // hex string like 0x0, could use some parsing
  groups: string[];
  nickname: string;
  status: string;
}
export type Contacts = Record<Ship, Contact>;
type AppName = string;

export type SettingsValue =
  | string
  | number
  | boolean
  | null
  | SettingsValue[]
  | { [key: string]: SettingsValue };

export type SettingsMap = Record<string, SettingsValue>;
// export type SettingsRes = { all: Record<AppName, SettingsMap> };
export type SettingsRes = { desk: Record<string, SettingsMap> };
export type StorageCredentials = {
  accessKeyId: string;
  endpoint: string;
  secretAccessKey: string;
};
export type StorageConfiguration = {
  currentBucket: string;
  bucket: string[];
  presignedUrl: string;
  region: string;
  service: "credentials";
};
export type StorageCredentialsRes = {
  "storage-update": { credentials: StorageCredentials };
};
export type StorageConfigurationRes = {
  "storage-update": { configuration: StorageConfiguration };
};
