<?php

namespace Framio\Profiles\ProfileStories\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Api\Controller\AbstractCreateController;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Contracts\Filesystem\Factory as FilesystemFactory;
use Illuminate\Contracts\Filesystem\FileExistsException;
use Illuminate\Support\Arr;
use Framio\Profiles\ProfileStories\Serializer\BannerUploadSerializer;
use Laminas\Diactoros\UploadedFile;
use Psr\Http\Message\ServerRequestInterface;
use Tobscure\JsonApi\Document;
class BannerUploadController extends AbstractCreateController
{
    protected $uploadDir;
    protected $settings;
    public $serializer = BannerUploadSerializer::class;

    public function __construct(SettingsRepositoryInterface $settings, FilesystemFactory $filesystemFactory)
    {
        $this->uploadDir = $filesystemFactory->disk('flarum-assets');
        $this->settings = $settings;
    }

    /**
     * @throws PermissionDeniedException
     * @throws FileExistsException
     */
    protected function data(ServerRequestInterface $request, Document $document)
    {
        $actor = RequestUtil::getActor($request);

        $actor->assertAdmin();

        $uploadedFile = Arr::get($request->getUploadedFiles(), 'storyBanner');

        if (!$uploadedFile instanceof UploadedFile || $uploadedFile->getError() !== UPLOAD_ERR_OK) {
            throw new \Exception('File upload error');
        }

        $originalName = $uploadedFile->getClientFilename();
        $extension = pathinfo($originalName, PATHINFO_EXTENSION);

        $uniqueName = uniqid('storyBanner_') . '.' . $extension;
        $filePath = "extensions/justoverclock-profile-stories/$uniqueName";
        $stream = $uploadedFile->getStream()->getContents();
        $this->uploadDir->write($filePath, $stream);

        $this->settings->set('justoverclock-profile-stories.imagePreview', $filePath);

        return (object)[
            'id' => uniqid(),
            'path' => $filePath,
            'url' => $filePath,
        ];
    }
}
