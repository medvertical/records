import type { Express } from "express";
import { profileManager } from "../../../services/fhir/profile-manager";

export function setupProfileRoutes(app: Express) {
  // Profile Search
  app.get("/api/profiles/search", async (req, res) => {
    try {
      const { query, limit = 20 } = req.query;
      const profiles = await profileManager.searchProfiles(query as string, parseInt(limit as string));
      res.json(profiles);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Profile Versions
  app.get("/api/profiles/versions", async (req, res) => {
    try {
      const { profileUrl } = req.query;
      const versions = await profileManager.getProfileVersions(profileUrl as string);
      res.json(versions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Installed Profiles
  app.get("/api/profiles/installed", async (req, res) => {
    try {
      const profiles = await profileManager.getInstalledProfiles();
      res.json(profiles);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Install Profile
  app.post("/api/profiles/install", async (req, res) => {
    try {
      const { url, name, version } = req.body;
      const profile = await profileManager.installProfile(url, name, version);
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Uninstall Profile
  app.post("/api/profiles/uninstall", async (req, res) => {
    try {
      const { profileId } = req.body;
      await profileManager.uninstallProfile(profileId);
      res.json({ message: "Profile uninstalled" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update Profile
  app.post("/api/profiles/update", async (req, res) => {
    try {
      const { profileId, version } = req.body;
      const profile = await profileManager.updateProfile(profileId, version);
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Check for Profile Updates
  app.get("/api/profiles/updates", async (req, res) => {
    try {
      const updates = await profileManager.checkForUpdates();
      res.json(updates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
