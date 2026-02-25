use std::fmt::{Display, Formatter};

#[derive(Debug)]
pub enum ToolsError {
    Validation(String),
    NotFound(String),
    Conflict(String),
    Database(String),
    Io(String),
    Zip(String),
}

pub type ToolsResult<T> = Result<T, ToolsError>;

impl ToolsError {
    pub fn user_message(&self) -> String {
        match self {
            Self::Validation(message)
            | Self::NotFound(message)
            | Self::Conflict(message)
            | Self::Database(message)
            | Self::Io(message)
            | Self::Zip(message) => message.clone(),
        }
    }
}

impl Display for ToolsError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.user_message())
    }
}

impl std::error::Error for ToolsError {}

impl From<sqlx::Error> for ToolsError {
    fn from(value: sqlx::Error) -> Self {
        Self::Database(format!("Database operation failed: {value}"))
    }
}

impl From<std::io::Error> for ToolsError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(format!("File operation failed: {value}"))
    }
}
