use std::fmt::{Display, Formatter};

#[derive(Debug)]
pub enum HelpError {
    Validation(String),
    NotFound(String),
    Database(String),
    Io(String),
}

pub type HelpResult<T> = Result<T, HelpError>;

impl HelpError {
    pub fn user_message(&self) -> String {
        match self {
            Self::Validation(message)
            | Self::NotFound(message)
            | Self::Database(message)
            | Self::Io(message) => message.clone(),
        }
    }
}

impl Display for HelpError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.user_message())
    }
}

impl std::error::Error for HelpError {}

impl From<sqlx::Error> for HelpError {
    fn from(value: sqlx::Error) -> Self {
        Self::Database(format!("Database operation failed: {value}"))
    }
}

impl From<std::io::Error> for HelpError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(format!("File operation failed: {value}"))
    }
}

impl From<crate::tools::error::ToolsError> for HelpError {
    fn from(value: crate::tools::error::ToolsError) -> Self {
        Self::Database(value.user_message())
    }
}
