import os


def reset_temp_folder():
    """
        Resets temp folder on every startup
    """
    removed_temp_files = []

    for file in ('temp_path/external', 'temp_path/internal'):
        os.makedirs(file, exist_ok=True)
        for file_name in os.listdir(file):
            file_path = os.path.join(file, file_name)
            removed_temp_files.append(str(file_path))
            if os.path.isfile(file_path):
                os.unlink(file_path)

    return removed_temp_files
