/**
 * Announcements API Models
 * Represents announcements displayed on the Home page, managed by the admin/Internship Office
 */

export interface Announcement {
  id: string;
  message: string;
  title?: string;
  link?: string;
  pinned?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateAnnouncementRequest {
  message: string;
  title?: string;
  link?: string;
  pinned?: boolean;
}

export interface UpdateAnnouncementRequest {
  id: string;
  title: string;
  message: string;
  link: string;
  pinned: boolean;
}

export interface AnnouncementResponse {
  message?: string;
  announcement?: Announcement;
  announcements?: Announcement[];
  id?: string;
  success?: boolean;
}

export interface GetAnnouncementsResponse {
  message?: string;
  announcements: Announcement[];
  total?: number;
}
