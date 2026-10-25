import UIKit
import Capacitor
import Photos
import PhotosUI
import AVFoundation
import UniformTypeIdentifiers
import TikTokOpenShareSDK

/// SocialSharePlugin — one-tap "Instagram story" and "TikTok" from the
/// review Share sheet (Luca 2026-10-24/25; setup in
/// docs/ONE-TAP-SHARE-SETUP.md). The web page calls it as
/// `SocialShare` (lib/native.ts → components/share/ReviewShareSheet.tsx).
///
/// Files come in as file:// URIs the page already wrote into the app's
/// cache with the Filesystem plugin (the same trick the normal Share
/// button uses), so no big base64 blobs cross the bridge twice.
///
/// INSTAGRAM STORIES: Meta's documented door. Put the background (a
/// video or an image) and an optional sticker PNG on the pasteboard
/// under Instagram's keys, then open instagram-stories://share with our
/// Facebook App ID. Instagram opens its story editor with the sticker
/// as a real, movable sticker. No login, no Meta SDK.
///
/// TIKTOK: TikTok has no sticker layer for other apps, so when someone
/// picks their own clip we glue the sticker onto it here first
/// (AVFoundation), save the result to Photos (TikTok's Share Kit only
/// takes Photos library items), and hand TikTok that item with
/// TikTokShareRequest. TikTok opens its editor with the video loaded.
///
/// Registered by AppViewController.capacitorDidLoad (AppDelegate.swift),
/// so it needs no npm package.
@objc(SocialSharePlugin)
public class SocialSharePlugin: CAPPlugin, CAPBridgedPlugin, PHPickerViewControllerDelegate {
    public let identifier = "SocialSharePlugin"
    public let jsName = "SocialShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "instagramStory", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "tiktok", returnType: CAPPluginReturnPromise),
    ]

    /// Meta app "Peak Music" (developers.facebook.com, 2026-10-25). Not a
    /// secret — Instagram reads it from the share URL to know who's sharing.
    static let facebookAppID = "3357751604411052"
    /// Where TikTok sends people back after sharing. A Universal Link:
    /// public/.well-known → app/.well-known/apple-app-site-association
    /// claims this one path for the app, and the Associated Domains
    /// entitlement (App.entitlements) lets the app accept it.
    static let tiktokRedirectURI = "https://peakmusicreviews.com/share/tiktok-callback"
    /// Instagram's story video limit (Meta: up to 20 seconds).
    static let instagramMaxSeconds = 20.0

    /// TikTok's SDK only calls back if the request stays alive until
    /// TikTok answers, so we hold on to it here.
    private var tiktokRequest: TikTokShareRequest?
    /// The JS call waiting on the clip picker, and what to do with the clip.
    private var pickerCall: CAPPluginCall?
    private var pickerTarget: String = "instagram"

    // MARK: - isAvailable

    /// Which of the two apps is installed. Needs both schemes listed in
    /// Info.plist → LSApplicationQueriesSchemes, or canOpenURL says no.
    @objc func isAvailable(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let app = UIApplication.shared
            let instagram = app.canOpenURL(URL(string: "instagram-stories://share")!)
            let tiktok = app.canOpenURL(URL(string: "snssdk1233://")!)
                || app.canOpenURL(URL(string: "snssdk1180://")!)
                || app.canOpenURL(URL(string: "tiktoksharesdk://")!)
            call.resolve(["instagram": instagram, "tiktok": tiktok])
        }
    }

    // MARK: - Instagram story

    /// Options from the page:
    ///   videoPath    — the scorecard video (becomes the story background)
    ///   stickerPath  — the see-through sticker PNG (lands on top, movable)
    ///   pickBackground — true: let them pick their own clip/photo first
    ///   topColor / bottomColor — background gradient when there's no
    ///                  background media (hex like "#0f1015")
    @objc func instagramStory(_ call: CAPPluginCall) {
        if call.getBool("pickBackground") ?? false {
            presentPicker(for: call, target: "instagram")
            return
        }
        let video = fileURL(call.getString("videoPath"))
        sendToInstagram(call, video: video, image: nil)
    }

    private func sendToInstagram(_ call: CAPPluginCall, video: URL?, image: Data?) {
        var item: [String: Any] = [:]
        if let stickerURL = fileURL(call.getString("stickerPath")),
           let sticker = try? Data(contentsOf: stickerURL) {
            item["com.instagram.sharedSticker.stickerImage"] = sticker
        }
        if let image = image {
            item["com.instagram.sharedSticker.backgroundImage"] = image
        }
        item["com.instagram.sharedSticker.backgroundTopColor"] = call.getString("topColor") ?? "#0f1015"
        item["com.instagram.sharedSticker.backgroundBottomColor"] = call.getString("bottomColor") ?? "#0f1015"
        // Older Meta docs read the app ID from the pasteboard, current ones
        // from the URL — sending both costs nothing.
        item["com.instagram.sharedSticker.appID"] = SocialSharePlugin.facebookAppID

        let open: (URL?) -> Void = { trimmed in
            if let trimmed = trimmed, let data = try? Data(contentsOf: trimmed) {
                item["com.instagram.sharedSticker.backgroundVideo"] = data
            }
            DispatchQueue.main.async {
                guard let url = URL(string: "instagram-stories://share?source_application=\(SocialSharePlugin.facebookAppID)"),
                      UIApplication.shared.canOpenURL(url) else {
                    call.reject("Instagram isn't installed", "NOT_INSTALLED")
                    return
                }
                // Instagram reads the pasteboard as it opens; five minutes
                // is Meta's own example expiry, so it never lingers.
                UIPasteboard.general.setItems(
                    [item],
                    options: [.expirationDate: Date().addingTimeInterval(60 * 5)]
                )
                UIApplication.shared.open(url, options: [:]) { opened in
                    call.resolve(["opened": opened])
                }
            }
        }

        guard let video = video else {
            open(nil)
            return
        }
        // A picked clip can be minutes long; Instagram takes 20 seconds.
        // Our own scorecard is already under that (max ~19.6s), so this
        // only re-encodes when it has to.
        let asset = AVURLAsset(url: video)
        if CMTimeGetSeconds(asset.duration) <= SocialSharePlugin.instagramMaxSeconds {
            open(video)
        } else {
            export(asset: asset, sticker: nil, maxSeconds: SocialSharePlugin.instagramMaxSeconds) { url in
                open(url ?? video)
            }
        }
    }

    // MARK: - TikTok

    /// Options from the page:
    ///   videoPath    — the scorecard video, shared as-is
    ///   stickerPath + pickBackground — pick their own clip, glue the
    ///                  sticker onto it, share the result
    @objc func tiktok(_ call: CAPPluginCall) {
        if call.getBool("pickBackground") ?? false {
            presentPicker(for: call, target: "tiktok")
            return
        }
        guard let video = fileURL(call.getString("videoPath")) else {
            call.reject("No video to share", "NO_VIDEO")
            return
        }
        sendToTikTok(call, video: video)
    }

    private func sendToTikTok(_ call: CAPPluginCall, video: URL) {
        // TikTok's Share Kit takes Photos library items, not files: save
        // the video to Photos, then hand TikTok its identifier. Asking for
        // full access (not add-only) because TikTok needs to read the item
        // back — its docs say the sharing app must have library access.
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
            guard status == .authorized || status == .limited else {
                call.reject("No access to Photos", "PHOTOS_DENIED")
                return
            }
            var placeholder: PHObjectPlaceholder?
            PHPhotoLibrary.shared().performChanges({
                let request = PHAssetCreationRequest.forAsset()
                request.addResource(with: .video, fileURL: video, options: nil)
                placeholder = request.placeholderForCreatedAsset
            }) { ok, _ in
                guard ok, let id = placeholder?.localIdentifier else {
                    call.reject("Couldn't save the video", "SAVE_FAILED")
                    return
                }
                DispatchQueue.main.async {
                    let request = TikTokShareRequest(
                        localIdentifiers: [id],
                        mediaType: .video,
                        redirectURI: SocialSharePlugin.tiktokRedirectURI
                    )
                    self.tiktokRequest = request
                    _ = request.send { response in
                        self.tiktokRequest = nil
                        guard let share = response as? TikTokShareResponse else {
                            call.resolve(["shared": false])
                            return
                        }
                        // Backing out of TikTok's editor is a "not shared" too.
                        call.resolve(["shared": share.errorCode == .noError])
                    }
                }
            }
        }
    }

    // MARK: - Picking their own clip

    private func presentPicker(for call: CAPPluginCall, target: String) {
        DispatchQueue.main.async {
            var config = PHPickerConfiguration()
            config.selectionLimit = 1
            // Instagram can take a photo or a video behind the sticker;
            // TikTok's glued version needs a video.
            config.filter = target == "tiktok"
                ? PHPickerFilter.videos
                : PHPickerFilter.any(of: [PHPickerFilter.videos, PHPickerFilter.images])
            let picker = PHPickerViewController(configuration: config)
            picker.delegate = self
            self.pickerCall = call
            self.pickerTarget = target
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let call = pickerCall else { return }
        pickerCall = nil
        guard let provider = results.first?.itemProvider else {
            call.resolve(["cancelled": true])
            return
        }
        let target = pickerTarget

        if provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
            // The picker's file is deleted when this callback returns, so
            // copy it somewhere we own first.
            provider.loadFileRepresentation(forTypeIdentifier: UTType.movie.identifier) { url, _ in
                guard let url = url else {
                    call.reject("Couldn't open that clip", "PICK_FAILED")
                    return
                }
                let copy = FileManager.default.temporaryDirectory
                    .appendingPathComponent("peak-clip-\(UUID().uuidString).\(url.pathExtension)")
                do {
                    try FileManager.default.copyItem(at: url, to: copy)
                } catch {
                    call.reject("Couldn't open that clip", "PICK_FAILED")
                    return
                }
                if target == "instagram" {
                    self.sendToInstagram(call, video: copy, image: nil)
                } else {
                    let sticker = self.fileURL(call.getString("stickerPath"))
                        .flatMap { try? Data(contentsOf: $0) }
                        .flatMap { UIImage(data: $0) }
                    self.export(asset: AVURLAsset(url: copy), sticker: sticker, maxSeconds: nil) { glued in
                        guard let glued = glued else {
                            call.reject("Couldn't make the video", "EXPORT_FAILED")
                            return
                        }
                        self.sendToTikTok(call, video: glued)
                    }
                }
            }
        } else if provider.canLoadObject(ofClass: UIImage.self) {
            // Photos (Instagram only). HEIC → JPEG, which Instagram wants.
            provider.loadObject(ofClass: UIImage.self) { object, _ in
                guard let image = object as? UIImage, let jpeg = image.jpegData(compressionQuality: 0.9) else {
                    call.reject("Couldn't open that photo", "PICK_FAILED")
                    return
                }
                self.sendToInstagram(call, video: nil, image: jpeg)
            }
        } else {
            call.reject("That file type isn't supported", "PICK_FAILED")
        }
    }

    // MARK: - Helpers

    /// "file:///…/Library/Caches/x.mp4" (from Filesystem.writeFile) → URL.
    private func fileURL(_ path: String?) -> URL? {
        guard let path = path, !path.isEmpty else { return nil }
        if path.hasPrefix("file://") { return URL(string: path) }
        return URL(fileURLWithPath: path)
    }

    /// Re-encode a clip to MP4: optionally cut to `maxSeconds`, optionally
    /// with the sticker drawn on top for the whole clip (lower third,
    /// ~70% of the width, like it sits in the Share sheet preview).
    private func export(asset: AVURLAsset, sticker: UIImage?, maxSeconds: Double?, done: @escaping (URL?) -> Void) {
        guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetHighestQuality) else {
            done(nil)
            return
        }
        let out = FileManager.default.temporaryDirectory
            .appendingPathComponent("peak-share-\(UUID().uuidString).mp4")
        session.outputURL = out
        session.outputFileType = .mp4
        session.shouldOptimizeForNetworkUse = true
        if let limit = maxSeconds, CMTimeGetSeconds(asset.duration) > limit {
            session.timeRange = CMTimeRange(start: .zero, duration: CMTime(seconds: limit, preferredTimescale: 600))
        }

        if let sticker = sticker, asset.tracks(withMediaType: .video).first != nil {
            // propertiesOf: keeps the clip's rotation (phone videos are
            // stored sideways with a "turn me" flag) and its size.
            let composition = AVMutableVideoComposition(propertiesOf: asset)
            let size = composition.renderSize
            let parent = CALayer()
            parent.frame = CGRect(origin: .zero, size: size)
            let videoLayer = CALayer()
            videoLayer.frame = parent.frame
            parent.addSublayer(videoLayer)

            let width = size.width * 0.7
            let height = width * sticker.size.height / max(sticker.size.width, 1)
            let stickerLayer = CALayer()
            stickerLayer.contents = sticker.cgImage
            stickerLayer.contentsGravity = .resizeAspect
            // Core Animation's origin is bottom-left inside an export, so
            // a small y = near the bottom of the frame.
            stickerLayer.frame = CGRect(
                x: (size.width - width) / 2,
                y: size.height * 0.16,
                width: width,
                height: height
            )
            parent.addSublayer(stickerLayer)
            composition.animationTool = AVVideoCompositionCoreAnimationTool(
                postProcessingAsVideoLayer: videoLayer,
                in: parent
            )
            session.videoComposition = composition
        }

        session.exportAsynchronously {
            done(session.status == .completed ? out : nil)
        }
    }
}
