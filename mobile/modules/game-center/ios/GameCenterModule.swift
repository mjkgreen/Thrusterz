// Game Center for the Thrusterz shell (mobile/App.js): sign the local player
// in, post scores to leaderboards, unlock achievements and open Apple's own
// Game Center screens. The IDs are set up in App Store Connect.
import ExpoModulesCore
import GameKit

public class GameCenterModule: Module {
  // GameKit may call the sign-in handler more than once (e.g. after the
  // player signs in from Settings); the first answer settles the promise.
  private var signIn: Promise?

  public func definition() -> ModuleDefinition {
    Name("GameCenter")

    // Resolves true once the player is signed in, false if they aren't (or
    // dismiss Apple's sign-in sheet). Call once per launch.
    AsyncFunction("authenticate") { (promise: Promise) in
      let player = GKLocalPlayer.local
      if player.isAuthenticated { promise.resolve(true); return }
      self.signIn = promise
      player.authenticateHandler = { [weak self] viewController, _ in
        if let vc = viewController {
          GameCenterModule.topViewController()?.present(vc, animated: true)
          return
        }
        self?.signIn?.resolve(player.isAuthenticated)
        self?.signIn = nil
      }
    }.runOnQueue(.main)

    Function("isAuthenticated") { () -> Bool in
      GKLocalPlayer.local.isAuthenticated
    }

    // Posts one score to one leaderboard (Game Center keeps the best).
    AsyncFunction("submitScore") { (board: String, value: Int, promise: Promise) in
      guard GKLocalPlayer.local.isAuthenticated else { promise.resolve(false); return }
      GKLeaderboard.submitScore(value, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [board]) { error in
        promise.resolve(error == nil)
      }
    }

    // Marks achievements complete, one report each so an ID that isn't set
    // up in App Store Connect can't sink the others. Resolves the IDs that
    // went through.
    AsyncFunction("reportAchievements") { (ids: [String], banner: Bool, promise: Promise) in
      guard GKLocalPlayer.local.isAuthenticated else { promise.resolve([String]()); return }
      let group = DispatchGroup()
      let lock = NSLock()
      var done = [String]()
      for id in ids {
        let a = GKAchievement(identifier: id)
        a.percentComplete = 100
        a.showsCompletionBanner = banner
        group.enter()
        GKAchievement.report([a]) { error in
          if error == nil { lock.lock(); done.append(id); lock.unlock() }
          group.leave()
        }
      }
      group.notify(queue: .main) { promise.resolve(done) }
    }

    // Opens Apple's Game Center screen: "leaderboards", "achievements" or
    // anything else for the dashboard.
    AsyncFunction("show") { (view: String) in
      let state: GKGameCenterViewControllerState =
        view == "leaderboards" ? .leaderboards : view == "achievements" ? .achievements : .dashboard
      GKAccessPoint.shared.trigger(state: state) {}
    }.runOnQueue(.main)
  }

  private static func topViewController() -> UIViewController? {
    let window = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
    var top = window?.rootViewController
    while let next = top?.presentedViewController { top = next }
    return top
  }
}
