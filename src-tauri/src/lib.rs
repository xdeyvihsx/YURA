use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct YouTubeVideo {
    id: String,
    title: String,
    author_name: String,
    author_id: String,
    thumbnail: String,
    duration: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct TrendingResponse {
    videos: Vec<YouTubeVideo>,
}

#[tauri::command]
async fn get_trending_music() -> Result<TrendingResponse, String> {
    // Por ahora, retornamos datos de ejemplo
    // En el futuro, podemos implementar una solución real con un proxy o usar una API alternativa
    let videos = vec![
        YouTubeVideo {
            id: "video1".to_string(),
            title: "Ejemplo - Canción 1".to_string(),
            author_name: "Artista Ejemplo".to_string(),
            author_id: "artist1".to_string(),
            thumbnail: "https://via.placeholder.com/300".to_string(),
            duration: "3:45".to_string(),
        },
        YouTubeVideo {
            id: "video2".to_string(),
            title: "Ejemplo - Canción 2".to_string(),
            author_name: "Artista Ejemplo 2".to_string(),
            author_id: "artist2".to_string(),
            thumbnail: "https://via.placeholder.com/300".to_string(),
            duration: "4:20".to_string(),
        },
        YouTubeVideo {
            id: "video3".to_string(),
            title: "Ejemplo - Canción 3".to_string(),
            author_name: "Artista Ejemplo 3".to_string(),
            author_id: "artist3".to_string(),
            thumbnail: "https://via.placeholder.com/300".to_string(),
            duration: "3:15".to_string(),
        },
        YouTubeVideo {
            id: "video4".to_string(),
            title: "Ejemplo - Canción 4".to_string(),
            author_name: "Artista Ejemplo 4".to_string(),
            author_id: "artist4".to_string(),
            thumbnail: "https://via.placeholder.com/300".to_string(),
            duration: "5:00".to_string(),
        },
        YouTubeVideo {
            id: "video5".to_string(),
            title: "Ejemplo - Canción 5".to_string(),
            author_name: "Artista Ejemplo 5".to_string(),
            author_id: "artist5".to_string(),
            thumbnail: "https://via.placeholder.com/300".to_string(),
            duration: "3:30".to_string(),
        },
        YouTubeVideo {
            id: "video6".to_string(),
            title: "Ejemplo - Canción 6".to_string(),
            author_name: "Artista Ejemplo 6".to_string(),
            author_id: "artist6".to_string(),
            thumbnail: "https://via.placeholder.com/300".to_string(),
            duration: "4:10".to_string(),
        },
        YouTubeVideo {
            id: "video7".to_string(),
            title: "Ejemplo - Canción 7".to_string(),
            author_name: "Artista Ejemplo 7".to_string(),
            author_id: "artist7".to_string(),
            thumbnail: "https://via.placeholder.com/300".to_string(),
            duration: "3:55".to_string(),
        },
        YouTubeVideo {
            id: "video8".to_string(),
            title: "Ejemplo - Canción 8".to_string(),
            author_name: "Artista Ejemplo 8".to_string(),
            author_id: "artist8".to_string(),
            thumbnail: "https://via.placeholder.com/300".to_string(),
            duration: "4:05".to_string(),
        },
        YouTubeVideo {
            id: "video9".to_string(),
            title: "Ejemplo - Canción 9".to_string(),
            author_name: "Artista Ejemplo 9".to_string(),
            author_id: "artist9".to_string(),
            thumbnail: "https://via.placeholder.com/300".to_string(),
            duration: "3:40".to_string(),
        },
        YouTubeVideo {
            id: "video10".to_string(),
            title: "Ejemplo - Canción 10".to_string(),
            author_name: "Artista Ejemplo 10".to_string(),
            author_id: "artist10".to_string(),
            thumbnail: "https://via.placeholder.com/300".to_string(),
            duration: "4:25".to_string(),
        },
    ];

    Ok(TrendingResponse { videos })
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, get_trending_music])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
