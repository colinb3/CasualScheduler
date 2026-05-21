CREATE TABLE Casual (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);

CREATE TABLE Branch (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);

CREATE TABLE Shift (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    branch_id INTEGER NOT NULL,
    locked INTEGER NULL,
    FOREIGN KEY (branch_id) REFERENCES Branch(id)
    FOREIGN KEY (locked) REFERENCES Casual(id) ON DELETE SET NULL
);

CREATE TABLE Available (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    casual_id INTEGER NOT NULL,
    shift_id INTEGER NOT NULL,
    FOREIGN KEY (casual_id) REFERENCES Casual(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES Shift(id) ON DELETE CASCADE
);

CREATE TABLE Schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monday DATE NOT NULL UNIQUE
);

CREATE TABLE ScheduleShift (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL,
    shift_id INTEGER NOT NULL,
    casual_id INTEGER,
    FOREIGN KEY (schedule_id) REFERENCES Schedule(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES Shift(id) ON DELETE CASCADE,
    FOREIGN KEY (casual_id) REFERENCES Casual(id) ON DELETE SET NULL
);

INSERT INTO Branch (name) VALUES 
    ("Beacock"),
    ("Bostwick"),
    ("Byron"),
    ("Carson"),
    ("Cherryhill"),
    ("Childrens"),
    ("CIF"),
    ("Cherryhill"),
    ("East London"),
    ("Glanworth"),
    ("Jalna"),
    ("Lambeth"),
    ("Landon"),
    ("Lending"),
    ("Masonville"),
    ("Pond Mills"),
    ("Sherwood"),
    ("Stoney Creek");
